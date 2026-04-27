"use strict";

const nodeCrypto = require("crypto");
const axios = require("axios");

const SNAPSHOT_CACHE_MS = 10_000;

class WyzeCameraStreamingDelegate {
  constructor(camera) {
    this.camera = camera;
    // sessionID (hex) → { localRtpPort, localAudioRtpPort, videoSsrc, audioSsrc,
    //                     targetAddress, videoPort, rtcpPort, srtpKey, srtpSalt,
    //                     audioPort, audioRtcpPort, audioSrtpKey, audioSrtpSalt,
    //                     streamHandle }
    this._sessions = new Map();
    this._snapshotCache = null; // { buffer, expiresAt }
  }

  async handleSnapshotRequest(request, callback) {
    // Skip the slow live-capture fallback if we already know the camera is
    // offline — otherwise HomeKit waits for the full WebRTC timeout and
    // logs "snapshot handler slow to respond".
    if (this.camera.cameraOnline === false) {
      callback(new Error("Camera is offline"));
      return;
    }

    // Serve from cache when fresh — HomeKit polls snapshots aggressively
    // (every few seconds when the camera tile is visible).
    if (this._snapshotCache && this._snapshotCache.expiresAt > Date.now()) {
      callback(undefined, this._snapshotCache.buffer);
      return;
    }

    // Try the cloud thumbnail URL straight from the device payload we
    // already have cached on the accessory. Avoids re-fetching the entire
    // Wyze device list, which was the main source of "slow to respond".
    const thumbUrl = this.camera.device?.device_params?.camera_thumbnails?.[0]?.url;
    if (thumbUrl) {
      try {
        const resp = await axios.get(thumbUrl, {
          responseType: "arraybuffer",
          timeout: 4000,
        });
        const buffer = Buffer.from(resp.data);
        this._snapshotCache = { buffer, expiresAt: Date.now() + SNAPSHOT_CACHE_MS };
        callback(undefined, buffer);
        return;
      } catch (err) {
        this.camera.plugin.log.warn?.(
          `[Camera] [Snapshot] Cloud thumb failed for ${this.camera.display_name}: ${err.message} — falling back to capture`
        );
      }
    }

    // Last resort: full WebRTC capture. Slow, so we cache the result.
    try {
      const result = await this.camera.plugin.client.getCameraSnapshotImage(
        this.camera.mac,
        { skipCloud: true }
      );
      this._snapshotCache = { buffer: result.buffer, expiresAt: Date.now() + SNAPSHOT_CACHE_MS };
      callback(undefined, result.buffer);
    } catch (err) {
      this.camera.plugin.log.error(
        `[Camera] [Snapshot] Failed for ${this.camera.display_name}: ${err.message}`
      );
      callback(err);
    }
  }

  async prepareStream(request, callback) {
    const sessionKey = request.sessionID.toString("hex");
    const { localRtpPort, localAudioRtpPort, videoSsrc, audioSsrc, localAddress } =
      await this.camera.plugin.client.prepareCameraHKStream();

    // Generate the SRTP keys we will use when sending to HomeKit.
    // These must match what we give FFmpeg — HomeKit's own srtp_key/salt
    // in the request are for the reverse direction (HomeKit → plugin).
    const videoSrtpKey = nodeCrypto.randomBytes(16);
    const videoSrtpSalt = nodeCrypto.randomBytes(14);
    const audioSrtpKey = nodeCrypto.randomBytes(16);
    const audioSrtpSalt = nodeCrypto.randomBytes(14);

    this._sessions.set(sessionKey, {
      localRtpPort,
      localAudioRtpPort,
      videoSsrc,
      audioSsrc,
      targetAddress: request.targetAddress,
      videoPort: request.video.port,
      rtcpPort: request.video.rtcp_port ?? request.video.port + 1,
      srtpKey: videoSrtpKey,
      srtpSalt: videoSrtpSalt,
      audioPort: request.audio?.port ?? null,
      audioRtcpPort: request.audio?.rtcp_port ?? (request.audio?.port ? request.audio.port + 1 : null),
      audioSrtpKey,
      audioSrtpSalt,
      streamHandle: null,
    });

    callback(undefined, {
      address: { address: localAddress, type: "v4" },
      video: {
        port: localRtpPort,
        ssrc: videoSsrc,
        srtp_key: videoSrtpKey,
        srtp_salt: videoSrtpSalt,
      },
      audio: {
        port: localAudioRtpPort,
        ssrc: audioSsrc,
        srtp_key: audioSrtpKey,
        srtp_salt: audioSrtpSalt,
      },
    });
  }

  handleStreamRequest(request, callback) {
    const { hap } = require("../types");
    const { StreamRequestTypes } = hap;
    const sessionKey = request.sessionID.toString("hex");
    const session = this._sessions.get(sessionKey);

    // HomeKit's RTP-stream characteristic write must ack within ~5s. WebRTC
    // negotiation alone can take longer, so acknowledge immediately and do
    // the actual start/stop work in the background.
    if (typeof callback === "function") callback();

    if (
      request.type === StreamRequestTypes.START ||
      request.type === StreamRequestTypes.RECONFIGURE
    ) {
      if (!session) return;
      session.streamHandle?.stop();
      session.streamHandle = null;
      (async () => {
        try {
          const handle = await this.camera.plugin.client.startCameraHKStream(
            this.camera.mac,
            this.camera.product_model,
            {
              localRtpPort: session.localRtpPort,
              localAudioRtpPort: session.localAudioRtpPort,
              targetAddress: session.targetAddress,
              videoPort: session.videoPort,
              rtcpPort: session.rtcpPort,
              srtpKey: session.srtpKey,
              srtpSalt: session.srtpSalt,
              videoSsrc: session.videoSsrc,
              audioPort: session.audioPort,
              audioRtcpPort: session.audioRtcpPort,
              audioSrtpKey: session.audioSrtpKey,
              audioSrtpSalt: session.audioSrtpSalt,
              audioSsrc: session.audioSsrc,
              bitrate: request.video?.max_bit_rate ?? 300,
              logger: this.camera.plugin.config.pluginLoggingEnabled
                ? this.camera.plugin.log
                : null,
            }
          );
          // The session may have been torn down while we were awaiting.
          if (this._sessions.get(sessionKey) === session) {
            session.streamHandle = handle;
          } else {
            handle?.stop();
          }
        } catch (err) {
          this.camera.plugin.log.error(
            `[Camera] [Stream] Failed for ${this.camera.display_name}: ${err.message}`
          );
        }
      })();
    } else if (request.type === StreamRequestTypes.STOP) {
      if (session) {
        session.streamHandle?.stop();
        this._sessions.delete(sessionKey);
      }
    }
  }
}

module.exports = WyzeCameraStreamingDelegate;
