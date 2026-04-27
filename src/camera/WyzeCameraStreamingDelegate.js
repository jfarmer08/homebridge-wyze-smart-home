/**
 * HomeKit camera streaming delegate for Wyze cameras.
 *
 * Snapshot: fetches from cloud thumbnail or captures via headless WebRTC+FFmpeg.
 * Live video: establishes a WebRTC connection to the camera (via werift inside
 *   wyze-api), forwards H.264 RTP to a local UDP socket, then spawns FFmpeg
 *   (bundled via ffmpeg-static inside wyze-api) to re-stream as SRTP to HomeKit.
 *
 * No external tools required — everything runs in-process.
 */

"use strict";

const dgram = require("dgram");
const fs = require("fs");
const os = require("os");
const path = require("path");
const nodeCrypto = require("crypto");
const { spawn } = require("child_process");

let _ffmpegBin = null;
function ffmpegPath() {
  if (_ffmpegBin) return _ffmpegBin;
  try {
    // ffmpeg-static is a dep of wyze-api — resolve from there so it works
    // whether or not the homebridge plugin lists it directly.
    const p = require("ffmpeg-static");
    if (p && fs.existsSync(p)) return (_ffmpegBin = p);
  } catch (_) {}
  return (_ffmpegBin = "ffmpeg");
}

function pickFreeUdpPort() {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    sock.once("error", reject);
    sock.bind(0, "127.0.0.1", () => {
      const { port } = sock.address();
      sock.close(() => resolve(port));
    });
  });
}

function localIpAddress() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const entry of iface) {
      if (!entry.internal && entry.family === "IPv4") return entry.address;
    }
  }
  return "0.0.0.0";
}

function writeSdpFile(rtpPort) {
  const sdp = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=WyzeStream",
    "c=IN IP4 127.0.0.1",
    "t=0 0",
    `m=video ${rtpPort} RTP/AVP 96`,
    "a=rtpmap:96 H264/90000",
    "a=fmtp:96 packetization-mode=1",
    "",
  ].join("\r\n");
  const sdpPath = path.join(
    os.tmpdir(),
    `wyze-stream-${process.pid}-${nodeCrypto.randomBytes(4).toString("hex")}.sdp`
  );
  fs.writeFileSync(sdpPath, sdp);
  return sdpPath;
}

class WyzeCameraStreamingDelegate {
  constructor(camera) {
    this.camera = camera;
    // sessionID (Buffer) → { rtpForwarder, ffmpeg, sdpPath }
    this._sessions = new Map();
  }

  // ---- Snapshot -----------------------------------------------------------

  async handleSnapshotRequest(request, callback) {
    try {
      const result = await this.camera.plugin.client.getCameraSnapshotImage(
        this.camera.mac,
        { skipCloud: false }
      );
      callback(undefined, result.buffer);
    } catch (err) {
      this.camera.plugin.log.error(
        `[Camera] [Snapshot] Failed for ${this.camera.display_name}: ${err.message}`
      );
      callback(err);
    }
  }

  // ---- Stream negotiation --------------------------------------------------

  async prepareStream(request, callback) {
    const sessionKey = request.sessionID.toString("hex");

    const videoSsrc = nodeCrypto.randomBytes(4).readUInt32BE(0);
    const localAddress = localIpAddress();

    // Pick a free local UDP port where FFmpeg will listen for RTP from werift
    const localRtpPort = await pickFreeUdpPort();

    this._sessions.set(sessionKey, {
      localRtpPort,
      targetAddress: request.targetAddress,
      videoPort: request.video.port,
      videoRtcpPort: request.video.rtcp_port ?? request.video.port + 1,
      // HomeKit's SRTP key+salt — we use these to encrypt what we send
      srtpKey: request.video.srtp_key,
      srtpSalt: request.video.srtp_salt,
      videoSsrc,
      rtpForwarder: null,
      ffmpeg: null,
      sdpPath: null,
    });

    callback(undefined, {
      address: {
        address: localAddress,
        type: "v4",
      },
      video: {
        port: localRtpPort,
        ssrc: videoSsrc,
        // Keys for HomeKit to encrypt RTCP feedback back to us (we ignore it)
        srtp_key: nodeCrypto.randomBytes(16),
        srtp_salt: nodeCrypto.randomBytes(14),
      },
    });
  }

  // ---- Stream lifecycle ---------------------------------------------------

  async handleStreamRequest(request) {
    const { hap } = require("../types");
    const StreamRequestTypes = hap.StreamRequestTypes;
    const sessionKey = request.sessionID.toString("hex");

    switch (request.type) {
      case StreamRequestTypes.START:
        await this._startStream(sessionKey, request.video);
        break;
      case StreamRequestTypes.RECONFIGURE:
        // Bitrate/resolution change — restart FFmpeg with new params if needed
        await this._stopStream(sessionKey);
        await this._startStream(sessionKey, request.video);
        break;
      case StreamRequestTypes.STOP:
        await this._stopStream(sessionKey);
        break;
    }
  }

  async _startStream(sessionKey, videoConfig) {
    const session = this._sessions.get(sessionKey);
    if (!session) return;

    const { mac, product_model, display_name } = this.camera;
    if (this.camera.plugin.config.pluginLoggingEnabled)
      this.camera.plugin.log(
        `[Camera] [Stream] Starting for ${display_name} → ${session.targetAddress}:${session.videoPort}`
      );

    // 1. Start WebRTC → local RTP forwarding
    try {
      session.rtpForwarder = await this.camera.plugin.client.cameraStartRtpForwarding(
        mac,
        product_model,
        session.localRtpPort
      );
    } catch (err) {
      this.camera.plugin.log.error(
        `[Camera] [Stream] WebRTC connect failed for ${display_name}: ${err.message}`
      );
      return;
    }

    // 2. Write SDP input file describing the local RTP source
    session.sdpPath = writeSdpFile(session.localRtpPort);

    // 3. Build SRTP output params (HomeKit's key+salt, base64-encoded)
    const srtpOutParams = Buffer.concat([session.srtpKey, session.srtpSalt]).toString("base64");
    const bitrate = Math.min(videoConfig.max_bit_rate ?? 300, 2000);

    // 4. Spawn FFmpeg: local RTP → SRTP to HomeKit
    const args = [
      "-loglevel", "warning",
      "-protocol_whitelist", "file,rtp,udp,srtp,crypto",
      "-fflags", "+genpts+nobuffer",
      "-flags", "low_delay",
      "-i", session.sdpPath,
      // Pass H.264 through without re-encoding (Wyze already sends Baseline)
      "-c:v", "copy",
      "-payload_type", "99",
      "-ssrc", String(session.videoSsrc),
      "-f", "rtp",
      "-srtp_out_suite", "AES_CM_128_HMAC_SHA1_80",
      "-srtp_out_params", srtpOutParams,
      `srtp://${session.targetAddress}:${session.videoPort}?rtcpport=${session.videoRtcpPort}&pkt_size=1316`,
    ];

    session.ffmpeg = spawn(ffmpegPath(), args, { stdio: ["ignore", "pipe", "pipe"] });

    session.ffmpeg.stderr.on("data", (chunk) => {
      if (this.camera.plugin.config.pluginLoggingEnabled)
        this.camera.plugin.log(`[Camera] [FFmpeg] ${chunk.toString().trimEnd()}`);
    });

    session.ffmpeg.once("close", (code) => {
      if (code && code !== 0 && code !== null)
        this.camera.plugin.log.error(
          `[Camera] [Stream] FFmpeg exited (${code}) for ${display_name}`
        );
    });
  }

  async _stopStream(sessionKey) {
    const session = this._sessions.get(sessionKey);
    if (!session) return;

    if (this.camera.plugin.config.pluginLoggingEnabled)
      this.camera.plugin.log(
        `[Camera] [Stream] Stopping for ${this.camera.display_name}`
      );

    try { session.ffmpeg?.kill("SIGKILL"); } catch (_) {}
    try { session.rtpForwarder?.stop(); } catch (_) {}
    try { if (session.sdpPath) fs.unlinkSync(session.sdpPath); } catch (_) {}

    this._sessions.delete(sessionKey);
  }
}

module.exports = WyzeCameraStreamingDelegate;
