"use strict";

const nodeCrypto = require("crypto");

class WyzeCameraStreamingDelegate {
  constructor(camera) {
    this.camera = camera;
    // sessionID (hex string) → { localRtpPort, videoSsrc, targetAddress, videoPort, rtcpPort, srtpKey, srtpSalt, streamHandle }
    this._sessions = new Map();
  }

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

  async prepareStream(request, callback) {
    const sessionKey = request.sessionID.toString("hex");
    const { localRtpPort, videoSsrc, localAddress } =
      await this.camera.plugin.client.prepareCameraHKStream();

    this._sessions.set(sessionKey, {
      localRtpPort,
      videoSsrc,
      targetAddress: request.targetAddress,
      videoPort: request.video.port,
      rtcpPort: request.video.rtcp_port ?? request.video.port + 1,
      srtpKey: request.video.srtp_key,
      srtpSalt: request.video.srtp_salt,
      streamHandle: null,
    });

    callback(undefined, {
      address: { address: localAddress, type: "v4" },
      video: {
        port: localRtpPort,
        ssrc: videoSsrc,
        srtp_key: nodeCrypto.randomBytes(16),
        srtp_salt: nodeCrypto.randomBytes(14),
      },
    });
  }

  async handleStreamRequest(request) {
    const { hap } = require("../types");
    const { StreamRequestTypes } = hap;
    const sessionKey = request.sessionID.toString("hex");
    const session = this._sessions.get(sessionKey);

    if (
      request.type === StreamRequestTypes.START ||
      request.type === StreamRequestTypes.RECONFIGURE
    ) {
      if (!session) return;
      session.streamHandle?.stop();
      try {
        session.streamHandle = await this.camera.plugin.client.startCameraHKStream(
          this.camera.mac,
          this.camera.product_model,
          {
            localRtpPort: session.localRtpPort,
            targetAddress: session.targetAddress,
            videoPort: session.videoPort,
            rtcpPort: session.rtcpPort,
            srtpKey: session.srtpKey,
            srtpSalt: session.srtpSalt,
            videoSsrc: session.videoSsrc,
            bitrate: request.video?.max_bit_rate ?? 300,
            logger: this.camera.plugin.config.pluginLoggingEnabled
              ? this.camera.plugin.log
              : null,
          }
        );
      } catch (err) {
        this.camera.plugin.log.error(
          `[Camera] [Stream] Failed for ${this.camera.display_name}: ${err.message}`
        );
      }
    } else if (request.type === StreamRequestTypes.STOP) {
      if (session) {
        session.streamHandle?.stop();
        this._sessions.delete(sessionKey);
      }
    }
  }
}

module.exports = WyzeCameraStreamingDelegate;
