const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const enums = require("../enums");
const WyzeCameraStreamingDelegate = require("../camera/WyzeCameraStreamingDelegate");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeCamera extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // CameraController is deferred to first updateCharacteristics so it runs
    // after homebridge publishes the bridge (not during configureAccessory).
    this._cameraControllerReady = false;
    this.cameraOnline = false;

    // Restore last-known characteristic values from disk so HomeKit shows
    // the right state immediately on reboot instead of "undefined" until
    // the first refresh cycle runs.
    const persisted = this.loadPersistedState();
    this.on = persisted.on;                       // privacy (PID-driven)
    this.power_switch = persisted.power_switch;   // privacy (bulk-list)
    this.notification = persisted.notification;
    this.siren = persisted.siren;
    this.floodLight = persisted.floodLight;       // shared with spotlight (P1056)
    this.garageDoor = persisted.garageDoor;

    // Remove any MotionSensor service left over from earlier plugin versions —
    // we don't have a reliable way to detect motion so we no longer expose it.
    const staleMotion = this.homeKitAccessory.getService(Service.MotionSensor);
    if (staleMotion) this.homeKitAccessory.removeService(staleMotion);

    if (!Object.values(enums.CameraModels).includes(this.product_model)) return;

    // Privacy switch — always added for cameras. Legacy fallback covers
    // cameras that were paired before we started naming the service
    // "<name> Privacy" (used to be just the camera name).
    this.privacySwitch = this._getOrAddService({
      ServiceType: Service.Switch,
      subtype: "Privacy",
      defaultName: `${this.display_name} Privacy`,
      legacyLookup: () => this.homeKitAccessory.getService(this.display_name),
      label: "Privacy Switch",
    });
    this.privacySwitch
      .getCharacteristic(Characteristic.On)
      .onGet(this.handleOnGetPrivacySwitch.bind(this))
      .onSet(this.handleOnSetPrivacySwitch.bind(this));

    if (!this.cameraAccessoryAttached()) return;

    // Optional services driven by per-MAC config arrays.
    if (this._isInConfig("garageDoorAccessory")) {
      this.garageDoorEnabled = true;
      this.garageDoorService = this._getOrAddService({
        ServiceType: Service.GarageDoorOpener,
        subtype: "GarageDoor",
        defaultName: `${this.display_name} Garage Door`,
        label: "Garage Door",
      });
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

    if (this._isInConfig("spotLightAccessory")) {
      this.spotLightEnabled = true;
      this.spotLightService = this._getOrAddService({
        ServiceType: Service.Lightbulb,
        subtype: "Spotlight",
        defaultName: `${this.display_name} Spotlight`,
        label: "Spotlight",
      });
      this.spotLightService
        .getCharacteristic(Characteristic.On)
        .onGet(this.handleOnGetSpotlight.bind(this))
        .onSet(this.handleOnSetSpotlight.bind(this));
    }

    if (this._isInConfig("floodLightAccessory")) {
      this.floodLightEnabled = true;
      this.floodLightService = this._getOrAddService({
        ServiceType: Service.Lightbulb,
        subtype: "FloodLight",
        defaultName: `${this.display_name} Floodlight`,
        label: "Floodlight",
      });
      this.floodLightService
        .getCharacteristic(Characteristic.On)
        .onGet(this.handleOnGetFloodlight.bind(this))
        .onSet(this.handleOnSetFloodlight.bind(this));
    }

    if (this._isInConfig("sirenAccessory")) {
      this.sirenEnabled = true;
      this.sirenSwitch = this._getOrAddService({
        ServiceType: Service.Switch,
        subtype: "Siren",
        defaultName: `${this.display_name} Siren`,
        legacyLookup: () => this.homeKitAccessory.getService(`${this.display_name} Siren`),
        label: "Siren",
      });
      this.sirenSwitch
        .getCharacteristic(Characteristic.On)
        .onGet(this.handleOnGetAlarmSwitch.bind(this))
        .onSet(this.handleOnSetAlarmSwitch.bind(this));
    }

    if (this._isInConfig("notificationAccessory")) {
      this.notificationSwitch = this._getOrAddService({
        ServiceType: Service.Switch,
        subtype: "Notification",
        defaultName: `${this.display_name} Notifications`,
        legacyLookup: () =>
          this.homeKitAccessory.getService(`${this.display_name} Notification`),
        label: "Notifications",
      });
      this.notificationSwitch
        .getCharacteristic(Characteristic.On)
        .onGet(this.getNotification.bind(this))
        .onSet(this.setNotification.bind(this));
    }
  }

  // ---- Helpers --------------------------------------------------------------

  _isInConfig(key) {
    return Boolean(this.plugin.config[key]?.includes(this.mac));
  }

  _getOrAddService({ ServiceType, subtype, defaultName, legacyLookup, label }) {
    // Prefer subtype-based lookup (stable across renames). Fall back to a
    // legacy name-based lookup so cameras paired before the naming change
    // don't accidentally grow a duplicate service.
    let service = this.homeKitAccessory.getServiceById(ServiceType, subtype);
    if (!service && legacyLookup) service = legacyLookup();
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Camera] [${label}] Adding service for ${this.mac} (${this.display_name})`
        );
      service = this.homeKitAccessory.addService(ServiceType, defaultName, subtype);
      // Set ConfiguredName once at creation so the Home app shows a clear
      // default label. Don't overwrite on subsequent loads — that would
      // wipe out any rename the user has done themselves.
      if (Characteristic.ConfiguredName) {
        service.setCharacteristic(Characteristic.ConfiguredName, defaultName);
      }
    }
    return service;
  }

  // ---- HomeKit camera controller -------------------------------------------

  _setupCameraController() {
    const { hap } = require("../types");
    if (!hap?.CameraController) return; // unit-test environments

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

  // ---- Update cycle ---------------------------------------------------------

  async updateCharacteristics(device) {
    if (!this._cameraControllerReady) {
      this._cameraControllerReady = true;
      try {
        this._setupCameraController();
      } catch (err) {
        this.plugin.log.error(
          `[Camera] _setupCameraController failed for ${this.display_name}: ${err.message}\n${err.stack}`
        );
      }
    }

    try {
      this.cameraOnline = this.plugin.client.cameraIsOnline(device);
    } catch (err) {
      this.plugin.log.error(
        `[Camera] cameraIsOnline failed for ${this.display_name}: ${err.message}`
      );
      this.cameraOnline = false;
    }

    // StatusActive on every service so the user sees an "inactive" badge
    // when the camera is offline (much friendlier than the noResponse
    // banner — the last known state stays visible).
    markServiceOnline(this.privacySwitch, this.cameraOnline);
    markServiceOnline(this.sirenSwitch, this.cameraOnline);
    markServiceOnline(this.floodLightService, this.cameraOnline);
    markServiceOnline(this.spotLightService, this.cameraOnline);
    markServiceOnline(this.garageDoorService, this.cameraOnline);
    markServiceOnline(this.notificationSwitch, this.cameraOnline);

    if (!this.cameraOnline) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Camera] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }

    if (!this.cameraAccessoryAttached()) {
      // Privacy-only path — no extra API call, just read the bulk-list field.
      const powerSwitch = device.device_params?.power_switch;
      this.power_switch = powerSwitch;
      this.privacySwitch?.getCharacteristic(Characteristic.On).updateValue(powerSwitch);
      this.persistState({ power_switch: powerSwitch });
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Camera] ${this.mac} (${this.display_name}): privacy ${powerSwitch ? "on" : "off"}`
        );
      return;
    }

    // NOTE: one extra getDevicePID API call per refresh per camera that has
    // any attached accessory configured (garage / spotlight / floodlight /
    // siren / notification). Required because the bulk getObjectList
    // doesn't include those PIDs.
    let propertyList;
    try {
      propertyList = await this.plugin.client.getDevicePID(this.mac, this.product_model);
    } catch (err) {
      this.plugin.log.error(
        `[Camera] getDevicePID failed for ${this.display_name}: ${err.message}`
      );
      markServiceOnline(this.privacySwitch, false);
      return;
    }
    if (!propertyList?.data?.property_list) {
      this.plugin.log.error(
        `[Camera] getDevicePID returned unexpected data for ${this.display_name}`
      );
      return;
    }

    const summary = [];
    for (const property of propertyList.data.property_list) {
      switch (property.pid) {
        case "P1": // Notification
          if (this._isInConfig("notificationAccessory")) {
            this.notification = property.value;
            this.notificationSwitch?.getCharacteristic(Characteristic.On).updateValue(this.notification);
            summary.push(`notifications=${this.notification ? "on" : "off"}`);
          }
          break;
        case "P3": // Privacy
          this.on = property.value;
          this.privacySwitch?.getCharacteristic(Characteristic.On).updateValue(this.on);
          summary.push(`privacy=${this.on ? "on" : "off"}`);
          break;
        case "P5": // Available
          this.available = property.value;
          break;
        case "P1049": // Siren
          if (this._isInConfig("sirenAccessory")) {
            this.siren = property.value;
            this.sirenSwitch?.getCharacteristic(Characteristic.On).updateValue(this.siren);
            summary.push(`siren=${this.siren ? "on" : "off"}`);
          }
          break;
        case "P1056": // Spotlight / Floodlight (same PID — covers both)
          if (this._isInConfig("spotLightAccessory")) {
            this.floodLight = property.value;
            this.spotLightService?.getCharacteristic(Characteristic.On).updateValue(this.floodLight);
            summary.push(`spotlight=${this.floodLight ? "on" : "off"}`);
          }
          break;
        case "P1301": // Garage Door
          if (this._isInConfig("garageDoorAccessory")) {
            this.garageDoor = property.value;
            summary.push(`garage=${property.value == 1 ? "open" : "closed"}`);
          }
          break;
      }
    }

    // Persist whatever fields we successfully read so the next reboot
    // gets accurate values immediately instead of "undefined" until the
    // first refresh.
    this.persistState({
      on: this.on,
      notification: this.notification,
      siren: this.siren,
      floodLight: this.floodLight,
      garageDoor: this.garageDoor,
    });

    if (this.plugin.config.pluginLoggingEnabled && summary.length > 0)
      this.plugin.log(
        `[Camera] ${this.mac} (${this.display_name}): ${summary.join(", ")}`
      );
  }

  // ---- Get handlers --------------------------------------------------------

  async handleOnGetPrivacySwitch() {
    // Pull from the right cached field depending on whether we have an
    // attached accessory (PID-driven flow) or just the bulk list field.
    const value = this.cameraAccessoryAttached() ? this.on : this.power_switch;
    return value ?? 0;
  }

  async handleOnGetSpotlight()    { return this.floodLight ?? 0; }
  async handleOnGetFloodlight()   { return this.floodLight ?? 0; }
  async handleOnGetAlarmSwitch()  { return this.siren ?? 0; }
  async getNotification()         { return this.notification ?? 0; }

  async getGarageCurrentState() {
    return this.plugin.client.wyzeGarageDoorStateToHomeKit(this.garageDoor);
  }

  async getGarageTargetState() {
    return this.plugin.client.wyzeGarageDoorStateToHomeKit(this.garageDoor);
  }

  async handleObstructionDetectedGet() {
    return 0;
  }

  // ---- Set handlers --------------------------------------------------------

  async handleOnSetPrivacySwitch(value) {
    return this._set("Privacy", () =>
      this.plugin.client.cameraPrivacy(this.mac, this.product_model, value ? "power_on" : "power_off")
    );
  }

  async handleOnSetAlarmSwitch(value) {
    return this._set("Siren", () =>
      this.plugin.client.cameraSiren(this.mac, this.product_model, value ? "siren_on" : "siren_off")
    );
  }

  async handleOnSetSpotlight(value) {
    return this._set("Spotlight", () =>
      this.plugin.client.cameraSpotLight(this.mac, this.product_model, value ? "1" : "2")
    );
  }

  async handleOnSetFloodlight(value) {
    return this._set("Floodlight", () =>
      this.plugin.client.cameraFloodLight(this.mac, this.product_model, value ? "1" : "2")
    );
  }

  async setNotification(value) {
    return this._set("Notification", () =>
      this.plugin.client.cameraNotifications(this.mac, this.product_model, value ? "1" : "0")
    );
  }

  async setGarageTargetState(value) {
    await this._set("Garage Door", () =>
      this.plugin.client.garageDoor(this.mac, this.product_model)
    );
    // Optimistically reflect the user's intent — actual door state will
    // refresh on the next cycle's PID read.
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

  async _set(label, fn) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[Camera] [${label}] Set "${this.display_name}"`);
    try {
      await fn();
    } catch (err) {
      this.plugin.log.error(
        `[Camera] [${label}] Set failed for ${this.display_name}: ${err.message || err}`
      );
      throw err;
    }
  }

  cameraAccessoryAttached() {
    return (
      this._isInConfig("garageDoorAccessory") ||
      this._isInConfig("spotLightAccessory") ||
      this._isInConfig("sirenAccessory") ||
      this._isInConfig("floodLightAccessory") ||
      this._isInConfig("notificationAccessory")
    );
  }
};
