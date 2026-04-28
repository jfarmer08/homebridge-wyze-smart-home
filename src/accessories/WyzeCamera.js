const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const enums = require("../enums");
const WyzeCameraStreamingDelegate = require("../camera/WyzeCameraStreamingDelegate");

module.exports = class WyzeCamera extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // CameraController is deferred to first updateCharacteristics so it runs
    // after homebridge publishes the bridge (not during configureAccessory).
    this._cameraControllerReady = false;

    // Remove any MotionSensor service left over from earlier plugin versions —
    // we don't have a reliable way to detect motion (cloud event polling was
    // too laggy and noisy) so we no longer expose it.
    const staleMotion = this.homeKitAccessory.getService(Service.MotionSensor);
    if (staleMotion) this.homeKitAccessory.removeService(staleMotion);

    this.cameraOnline = false;

    if (Object.values(enums.CameraModels).includes(this.product_model)) {
      const privacyName = `${this.display_name} Privacy`;
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Camera] [Privacy Switch] Retrieving previous service for ${this.mac} (${this.display_name})`
        );
      // Look up by subtype (stable across renames). Fall back to legacy
      // name-based lookup so cameras that were paired before the rename
      // don't get a duplicate service added.
      this.privacySwitch =
        this.homeKitAccessory.getServiceById(Service.Switch, "Privacy") ||
        this.homeKitAccessory.getService(this.display_name);

      if (!this.privacySwitch) {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Camera] [Privacy Switch] Adding service for ${this.mac} (${this.display_name})`
          );
        this.privacySwitch = this.homeKitAccessory.addService(
          Service.Switch,
          privacyName,
          "Privacy"
        );
        // Set ConfiguredName once at creation so the Home app shows a clear
        // default label. Don't overwrite on subsequent loads — that would
        // wipe out any rename the user has done themselves.
        if (Characteristic.ConfiguredName) {
          this.privacySwitch.setCharacteristic(Characteristic.ConfiguredName, privacyName);
        }
      }

      this.privacySwitch
        .getCharacteristic(Characteristic.On)
        .onGet(this.handleOnGetPrivacySwitch.bind(this))
        .onSet(this.handleOnSetPrivacySwitch.bind(this));

      if (this.cameraAccessoryAttached()) {
        if (
          this.plugin.config.garageDoorAccessory?.find((d) => d === this.mac)
        ) {
          this.garageDoorEnabled = true;
          if (this.plugin.config.pluginLoggingEnabled)
            this.plugin.log(
              `[Camera] [Garage Door] Retrieving previous service for ${this.mac} (${this.display_name})`
            );
          const garageName = `${this.display_name} Garage Door`;
          this.garageDoorService = this.homeKitAccessory.getService(
            Service.GarageDoorOpener
          );
          if (!this.garageDoorService) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [Garage Door] Adding service for ${this.mac} (${this.display_name})`
              );
            this.garageDoorService = this.homeKitAccessory.addService(
              Service.GarageDoorOpener,
              garageName,
              "GarageDoor"
            );
            if (Characteristic.ConfiguredName) {
              this.garageDoorService.setCharacteristic(Characteristic.ConfiguredName, garageName);
            }
          }
          // create handlers for required characteristics
          this.garageDoorService
            .getCharacteristic(Characteristic.CurrentDoorState)
            .onGet(this.getGarageCurrentState.bind(this));

          this.garageDoorService
            .getCharacteristic(Characteristic.TargetDoorState)
            .onGet(this.getGarageTargetState.bind(this))
            .onSet(this.setGarageTargetState.bind(this));

          this.garageDoorService
            .getCharacteristic(Characteristic.ObstructionDetected)
            .onGet(this.handleObstructionDetectedGet.bind(this));
        }
        if (
          this.plugin.config.spotLightAccessory?.find((d) => d === this.mac)
        ) {
          this.spotLightEnabled = true;
          if (this.plugin.config.pluginLoggingEnabled)
            this.plugin.log(
              `[Camera] [Spotlight Switch] Retrieving previous service for ${this.mac} (${this.display_name})`
            );

          const spotName = `${this.display_name} Spotlight`;
          this.spotLightService = this.homeKitAccessory.getServiceById(
            Service.Lightbulb,
            "Spotlight"
          );
          if (!this.spotLightService) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [Spotlight] Adding service for ${this.mac} (${this.display_name})`
              );
            this.spotLightService = this.homeKitAccessory.addService(
              Service.Lightbulb,
              spotName,
              "Spotlight"
            );
            if (Characteristic.ConfiguredName) {
              this.spotLightService.setCharacteristic(Characteristic.ConfiguredName, spotName);
            }
          }

          this.spotLightService
            .getCharacteristic(Characteristic.On)
            .onGet(this.handleOnGetSpotlight.bind(this))
            .onSet(this.handleOnSetSpotlight.bind(this));
        }
        if (
          this.plugin.config.floodLightAccessory?.find((d) => d === this.mac)
        ) {
          this.floodLightEnabled = true;
          if (this.plugin.config.pluginLoggingEnabled)
            this.plugin.log(
              `[Camera] [FloodLight] Retrieving previous service for ${this.mac} (${this.display_name})`
            );

          const floodName = `${this.display_name} Floodlight`;
          this.floodLightService = this.homeKitAccessory.getServiceById(
            Service.Lightbulb,
            "FloodLight"
          );
          if (!this.floodLightService) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [FloodLight] Adding service for ${this.mac} (${this.display_name})`
              );
            this.floodLightService = this.homeKitAccessory.addService(
              Service.Lightbulb,
              floodName,
              "FloodLight"
            );
            if (Characteristic.ConfiguredName) {
              this.floodLightService.setCharacteristic(Characteristic.ConfiguredName, floodName);
            }
          }

          this.floodLightService
            .getCharacteristic(Characteristic.On)
            .onGet(this.handleOnGetFloodlight.bind(this))
            .onSet(this.handleOnSetFloodlight.bind(this));
        }
        if (this.plugin.config.sirenAccessory?.find((d) => d === this.mac)) {
          this.sirenEnabled = true;
          if (this.plugin.config.pluginLoggingEnabled)
            this.plugin.log(
              `[Camera] [Siren] Retrieving previous service for ${this.mac} (${this.display_name})`
            );
          const sirenName = `${this.display_name} Siren`;
          this.sirenSwitch =
            this.homeKitAccessory.getServiceById(Service.Switch, "Siren") ||
            this.homeKitAccessory.getService(sirenName);
          if (!this.sirenSwitch) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [Siren Switch] Adding service for ${this.mac} (${this.display_name})`
              );
            this.sirenSwitch = this.homeKitAccessory.addService(
              Service.Switch,
              sirenName,
              "Siren"
            );
            if (Characteristic.ConfiguredName) {
              this.sirenSwitch.setCharacteristic(Characteristic.ConfiguredName, sirenName);
            }
          }

          this.sirenSwitch
            .getCharacteristic(Characteristic.On)
            .onGet(this.handleOnGetAlarmSwitch.bind(this))
            .onSet(this.handleOnSetAlarmSwitch.bind(this));
        }
        if (
          this.plugin.config.notificationAccessory?.find((d) => d === this.mac)
        ) {
          if (this.plugin.config.pluginLoggingEnabled)
            this.plugin.log(
              `[Camera] [Notification] Retrieving previous service for ${this.mac} (${this.display_name})`
            );
          const notifName = `${this.display_name} Notifications`;
          this.notificationSwitch =
            this.homeKitAccessory.getServiceById(Service.Switch, "Notification") ||
            this.homeKitAccessory.getService(this.display_name + " Notification");
          if (!this.notificationSwitch) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [Notification] Adding service for ${this.mac} (${this.display_name})`
              );
            this.notificationSwitch = this.homeKitAccessory.addService(
              Service.Switch,
              notifName,
              "Notification"
            );
            if (Characteristic.ConfiguredName) {
              this.notificationSwitch.setCharacteristic(Characteristic.ConfiguredName, notifName);
            }
          }

          this.notificationSwitch
            .getCharacteristic(Characteristic.On)
            .onGet(this.getNotification.bind(this))
            .onSet(this.setNotification.bind(this));
        }
      }
    }
  }

  _setupCameraController() {
    const { hap } = require("../types");
    if (!hap?.CameraController) return; // guard for unit-test environments

    const delegate = new WyzeCameraStreamingDelegate(this);

    const controller = new hap.CameraController({
      cameraStreamCount: 2,
      delegate,
      streamingOptions: {
        supportedCryptoSuites: [hap.SRTPCryptoSuites.AES_CM_128_HMAC_SHA1_80],
        video: {
          resolutions: [
            [1920, 1080, 30],
            [1280, 720, 30],
            [1280, 720, 15],
            [640, 360, 30],
            [640, 360, 15],
            [320, 240, 15],
          ],
          codec: {
            profiles: [hap.H264Profile.BASELINE, hap.H264Profile.MAIN],
            levels: [hap.H264Level.LEVEL3_1, hap.H264Level.LEVEL4_0],
          },
        },
        audio: {
          twoWayAudio: false,
          codecs: [
            {
              type: hap.AudioStreamingCodecType.OPUS,
              samplerate: [
                hap.AudioStreamingSamplerate.KHZ_16,
                hap.AudioStreamingSamplerate.KHZ_24,
              ],
            },
          ],
        },
      },
    });

    this.homeKitAccessory.configureController(controller);

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Stream] CameraController configured for ${this.display_name} (${this.mac})`
      );
  }

  async updateCharacteristics(device) {
    if (!this._cameraControllerReady) {
      this._cameraControllerReady = true;
      try {
        this._setupCameraController();
      } catch (err) {
        this.plugin.log.error(`[Camera] _setupCameraController failed for ${this.display_name}: ${err.message}\n${err.stack}`);
      }
    }

    try {
      this.cameraOnline = this.plugin.client.cameraIsOnline(device);
    } catch (err) {
      this.plugin.log.error(`[Camera] cameraIsOnline failed for ${this.display_name}: ${err.message}`);
      this.cameraOnline = false;
    }

    if (!this.cameraOnline) {
      // If we've previously had real data, leave HomeKit on the last
      // known state instead of the unreachable banner. But on a fresh
      // install with the camera already offline, we have no real state
      // yet — fall back to the unreachable banner so the user isn't
      // shown a misleading default (e.g. privacy switch reading "off"
      // when we genuinely don't know).
      if (!this._hasGoodData) {
        const noResp = new Error("No Response");
        noResp.toString = () => noResp.message;
        this.privacySwitch?.getCharacteristic(Characteristic.On).updateValue(noResp);
        if (this.plugin.config.sirenAccessory?.find((d) => d === device.mac)) {
          this.sirenSwitch?.getCharacteristic(Characteristic.On).updateValue(noResp);
        }
        if (this.plugin.config.floodLightAccessory?.find((d) => d === this.mac)) {
          this.floodLightService?.getCharacteristic(Characteristic.On).updateValue(noResp);
        }
        if (this.plugin.config.spotLightAccessory?.find((d) => d === this.mac)) {
          this.spotLightService?.getCharacteristic(Characteristic.On).updateValue(noResp);
        }
        if (this.plugin.config.garageDoorAccessory?.find((d) => d === this.mac)) {
          this.garageDoorService?.getCharacteristic(Characteristic.CurrentDoorState).updateValue(noResp);
        }
        if (this.plugin.config.notificationAccessory?.find((d) => d === this.mac)) {
          this.notificationSwitch?.getCharacteristic(Characteristic.On).updateValue(noResp);
        }
      }
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Camera] ${this.mac} (${this.display_name}) is offline — ${this._hasGoodData ? "keeping last known state" : "showing as unreachable (no prior data)"}`
        );
    } else {
      this._hasGoodData = true;
      if (this.cameraAccessoryAttached()) {
        let propertyList;
        try {
          propertyList = await this.plugin.client.getDevicePID(this.mac, this.product_model);
        } catch (err) {
          this.plugin.log.error(`[Camera] getDevicePID failed for ${this.display_name}: ${err.message}`);
          return;
        }
        if (!propertyList?.data?.property_list) {
          this.plugin.log.error(`[Camera] getDevicePID returned unexpected data for ${this.display_name}`);
          return;
        }
        for (const property of propertyList.data.property_list) {
          switch (property.pid) {
            case "P1":
              if (
                this.plugin.config.notificationAccessory?.find(
                  (d) => d === this.mac
                )
              ) {
                if (this.plugin.config.pluginLoggingEnabled) {
                  this.plugin.log(
                    `[Camera] [Notification] Updating status of ${this.mac} (${this.display_name})`
                  );
                }
                this.notification = property.value;
                this.notificationSwitch
                  .getCharacteristic(Characteristic.On)
                  .updateValue(this.notification);
              }
              break;
            case "P3":
              if (this.plugin.config.pluginLoggingEnabled)
                this.plugin.log(
                  `[Camera] [Privacy] Updating status of ${this.mac} (${this.display_name})`
                );
              this.on = property.value;
              this.privacySwitch
                .getCharacteristic(Characteristic.On)
                .updateValue(this.on);
              break;
            case "P5":
              this.available = property.value;
              break;
            case "P1049":
              if (
                this.plugin.config.sirenAccessory?.find((d) => d === this.mac)
              ) {
                if (this.plugin.config.pluginLoggingEnabled) {
                  this.plugin.log(
                    `[Camera] [Siren] Updating status of ${this.mac} (${this.display_name})`
                  );
                }
                this.siren = property.value;
                this.sirenSwitch
                  .getCharacteristic(Characteristic.On)
                  .updateValue(this.siren);
              }
              break;
            case "P1056":
              if (
                this.plugin.config.spotLightAccessory?.find(
                  (d) => d === this.mac
                )
              ) {
                if (this.plugin.config.pluginLoggingEnabled) {
                  this.plugin.log(
                    `[Camera] [SpotLight] Updating status of ${this.mac} (${this.display_name})`
                  );
                }
                this.floodLight = property.value;
                this.spotLightService
                  .getCharacteristic(Characteristic.On)
                  .updateValue(this.floodLight);
              }
              break;
            case "P1301":
              if (
                this.plugin.config.garageDoorAccessory?.find(
                  (d) => d === this.mac
                )
              ) {
                if (this.plugin.config.pluginLoggingEnabled) {
                  this.plugin.log(
                    `[Camera] [Garage Door] Updating status of ${this.mac} (${this.display_name})`
                  );
                }
                this.garageDoor = property.value;
              }
              break;
          }
        }
      } else {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Camera] [Privacy] Updating status of ${this.mac} (${this.display_name})`
          );
        const powerSwitch = device.device_params?.power_switch;
        this.power_switch = powerSwitch;
        this.privacySwitch
          ?.getCharacteristic(Characteristic.On)
          .updateValue(powerSwitch);
      }
    }
  }

  async getGarageCurrentState() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera Garage Door] Getting Current State for ${this.mac} (${this.display_name} : ${this.garageDoor})`
      );
    let currentValue;

    if (this.garageDoor == 1) {
      currentValue = Characteristic.CurrentDoorState.OPEN;
    } else currentValue = Characteristic.CurrentDoorState.CLOSED;
    return currentValue;
  }

  async getGarageTargetState() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera Garage Door] Getting Target State for ${this.mac} (${this.display_name} : ${this.garageDoor})`
      );

    let currentValue;

    if (this.garageDoor == 1) {
      currentValue = Characteristic.TargetDoorState.OPEN;
    } else currentValue = Characteristic.TargetDoorState.CLOSED;

    return currentValue;
  }

  async handleObstructionDetectedGet() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera Garage Door] Getting ObstructionState for ${this.mac} (${this.display_name})`
      );

    return 0;
  }

  async handleOnGetPrivacySwitch() {
    if (this.cameraAccessoryAttached()) {
      this.powerSwitch = this.on;
    } else this.powerSwitch = this.power_switch;
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Privacy] Getting Current State for ${this.mac} (${this.display_name} : ${this.powerSwitch})`
      );
    if (this.powerSwitch === "undefined" || this.powerSwitch == null) {
      return 0;
    } else {
      return this.powerSwitch;
    }
  }

  async handleOnGetSpotlight() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [SpotLight] Getting Current State for ${this.mac} (${this.display_name} : ${this.floodLight})`
      );
    if (this.floodLight === "undefined" || this.floodLight == null) {
      return 0;
    } else return this.floodLight;
  }

  async handleOnGetFloodlight() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [FloodLight] Getting Current State for ${this.mac} (${this.display_name} : ${this.floodLight})`
      );
    if (this.floodLight === "undefined" || this.floodLight == null) {
      return 0;
    } else return this.floodLight;
  }

  async handleOnGetAlarmSwitch() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Siren] Getting Current State for ${this.mac} (${this.display_name} : ${this.siren})`
      );
    if (this.siren === "undefined" || this.siren == null) {
      return 0;
    } else return this.siren;
  }

  async getNotification() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Notification] Getting Current State for ${this.mac} (${this.display_name} : ${this.notification})`
      );
    if (this.notification === "undefined" || this.notification == null) {
      return 0;
    } else return this.notification;
  }

  async handleOnSetSpotlight(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [SpotLight] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    try {
      await this.plugin.client.cameraSpotLight(
        this.mac,
        this.product_model,
        value ? "1" : "2"
      );
    } catch (err) {
      this.plugin.log.error(
        `[Camera] [SpotLight] Set failed for ${this.display_name}: ${err.message}`
      );
      throw err;
    }
  }

  async handleOnSetFloodlight(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [FloodLight] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    try {
      await this.plugin.client.cameraFloodLight(
        this.mac,
        this.product_model,
        value ? "1" : "2"
      );
    } catch (err) {
      this.plugin.log.error(
        `[Camera] [FloodLight] Set failed for ${this.display_name}: ${err.message}`
      );
      throw err;
    }
  }

  async handleOnSetPrivacySwitch(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Privacy] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    try {
      await this.plugin.client.cameraPrivacy(
        this.mac,
        this.product_model,
        value ? "power_on" : "power_off"
      );
    } catch (err) {
      this.plugin.log.error(
        `[Camera] [Privacy] Set failed for ${this.display_name}: ${err.message}`
      );
      throw err;
    }
  }

  async handleOnSetAlarmSwitch(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Siren] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    try {
      await this.plugin.client.cameraSiren(
        this.mac,
        this.product_model,
        value ? "siren_on" : "siren_off"
      );
    } catch (err) {
      this.plugin.log.error(
        `[Camera] [Siren] Set failed for ${this.display_name}: ${err.message}`
      );
      throw err;
    }
  }

  async setNotification(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Notification] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    try {
      await this.plugin.client.cameraNotifications(
        this.mac,
        this.product_model,
        value ? "1" : "0"
      );
    } catch (err) {
      this.plugin.log.error(
        `[Camera] [Notification] Set failed for ${this.display_name}: ${err.message}`
      );
      throw err;
    }
  }

  async setGarageTargetState(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera Garage Door] Setting Target State for ${this.mac} (${this.display_name}) to ${value}`
      );
    try {
      await this.plugin.client.garageDoor(this.mac, this.product_model);
    } catch (err) {
      this.plugin.log.error(
        `[Camera] [Garage Door] Trigger failed for ${this.display_name}: ${err.message}`
      );
      throw err;
    }
    if (value == 0) {
      this.garageDoorService
        .getCharacteristic(Characteristic.CurrentDoorState)
        .updateValue(Characteristic.CurrentDoorState.OPEN);
    } else if (value == 1) {
      this.garageDoorService
        .getCharacteristic(Characteristic.CurrentDoorState)
        .updateValue(Characteristic.CurrentDoorState.CLOSED);
    }
  }

  cameraAccessoryAttached() {
    return !!(
      this.plugin.config.garageDoorAccessory?.find((d) => d === this.mac) ||
      this.plugin.config.spotLightAccessory?.find((d) => d === this.mac) ||
      this.plugin.config.sirenAccessory?.find((d) => d === this.mac) ||
      this.plugin.config.floodLightAccessory?.find((d) => d === this.mac) ||
      this.plugin.config.notificationAccessory?.find((d) => d === this.mac)
    );
  }
};
