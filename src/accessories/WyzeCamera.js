const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const enums = require("../enums");

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class WyzeCamera extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    if (Object.values(enums.CameraModels).includes(this.product_model)) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Camera] [Privacy Switch] Retrieving previous service for ${this.mac} (${this.display_name})`
        );
      this.privacySwitch = this.homeKitAccessory.getService(this.display_name);

      if (!this.privacySwitch) {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Camera] [Privacy Switch] Adding service for ${this.mac} (${this.display_name})`
          );
        this.privacySwitch = this.homeKitAccessory.addService(
          Service.Switch,
          this.display_name,
          "Privacy"
        );
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
          this.garageDoorService = this.homeKitAccessory.getService(
            Service.GarageDoorOpener
          );
          if (!this.garageDoorService) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [Garage Door] Adding service for ${this.mac} (${this.display_name})`
              );
            this.garageDoorService = this.homeKitAccessory.addService(
              Service.GarageDoorOpener
            );
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

          this.spotLightService = this.homeKitAccessory.getService(
            Service.Lightbulb
          );
          if (!this.spotLightService) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [Spotlight] Adding service for ${this.mac} (${this.display_name})`
              );
            this.spotLightService = this.homeKitAccessory.addService(
              Service.Lightbulb,
              this.display_name + " Spotlight",
              "Spotlight"
            );
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

          this.floodLightService = this.homeKitAccessory.getService(
            Service.Lightbulb
          );
          if (!this.floodLightService) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [FloodLight] Adding service for ${this.mac} (${this.display_name})`
              );
            this.floodLightService = this.homeKitAccessory.addService(
              Service.Lightbulb,
              this.display_name + " FloodLight",
              "FloodLight"
            );
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
          this.sirenSwitch = this.homeKitAccessory.getService(
            this.display_name + " Siren"
          );
          if (!this.sirenSwitch) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [Alarm Switch] Adding service for ${this.mac} (${this.display_name})`
              );
            this.sirenSwitch = this.homeKitAccessory.addService(
              Service.Switch,
              this.display_name + " Siren",
              "Siren"
            );
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
          this.notificationSwitch = this.homeKitAccessory.getService(
            this.display_name + " Notification"
          );
          if (!this.notificationSwitch) {
            if (this.plugin.config.pluginLoggingEnabled)
              this.plugin.log(
                `[Camera] [Notification] Adding service for ${this.mac} (${this.display_name})`
              );
            this.notificationSwitch = this.homeKitAccessory.addService(
              Service.Switch,
              this.display_name + " Notification",
              "Notification"
            );
          }

          this.notificationSwitch
            .getCharacteristic(Characteristic.On)
            .onGet(this.getNotification.bind(this))
            .onSet(this.setNotification.bind(this));
        }
      }
    }
  }

  async updateCharacteristics(device) {
    if (device.conn_state === 0) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Camera] Updating status ${this.mac} (${this.display_name}) to noResponse`
        );
      this.privacySwitch
        .getCharacteristic(Characteristic.On)
        .updateValue(noResponse);
      if (this.plugin.config.sirenAccessory?.find((d) => d === device.mac)) {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Camera] [Siren] Updating status ${this.mac} (${this.display_name}) to noResponse`
          );
        this.sirenSwitch
          .getCharacteristic(Characteristic.On)
          .updateValue(noResponse);
      }
      if (this.plugin.config.floodLightAccessory?.find((d) => d === this.mac)) {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Camera] [FloodLight] Updating status of ${this.mac} (${this.display_name}) to noResponse`
          );
        this.floodLightService
          .getCharacteristic(Characteristic.On)
          .updateValue(noResponse);
      }
      if (this.plugin.config.spotLightAccessory?.find((d) => d === this.mac)) {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Camera] [SpotLight] Updating status of ${this.mac} (${this.display_name}) to noResponse`
          );
        this.spotLightService
          .getCharacteristic(Characteristic.On)
          .updateValue(noResponse);
      }
      if (this.plugin.config.garageDoorAccessory?.find((d) => d === this.mac)) {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Camera] [Garage Door] Updating status of ${this.mac} (${this.display_name}) to noResponse`
          );
        this.garageDoorService
          .getCharacteristic(Characteristic.CurrentDoorState)
          .updateValue(noResponse);
      }
      if (
        this.plugin.config.notificationAccessory?.find((d) => d === this.mac)
      ) {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Camera] [Notification] Updating status of ${this.mac} (${this.display_name}) to noResponse`
          );
        this.notificationSwitch
          .getCharacteristic(Characteristic.On)
          .updateValue(noResponse);
      }
    } else {
      if (this.cameraAccessoryAttached()) {
        const propertyList = await this.plugin.client.getDevicePID(
          this.mac,
          this.product_model
        );
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
        this.power_switch = device.device_params.power_switch;
        this.privacySwitch
          .getCharacteristic(Characteristic.On)
          .updateValue(device.device_params.power_switch);
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
    this.plugin.client.cameraSpotLight(
      this.mac,
      this.product_model,
      value ? "1" : "2"
    );
  }

  async handleOnSetFloodlight(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [FloodLight] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    this.plugin.client.cameraFloodLight(
      this.mac,
      this.product_model,
      value ? "1" : "2"
    );
  }

  async handleOnSetPrivacySwitch(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Privacy] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    this.plugin.client.cameraPrivacy(
      this.mac,
      this.product_model,
      value ? "power_on" : "power_off"
    );
  }

  async handleOnSetAlarmSwitch(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Siren] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    this.plugin.client.cameraSiren(
      this.mac,
      this.product_model,
      value ? "siren_on" : "siren_off"
    );
  }

  async setNotification(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera] [Notification] Setting Current State for ${this.mac} (${this.display_name}) to ${value}`
      );
    this.plugin.client.cameraNotifications(
      this.mac,
      this.product_model,
      value ? "1" : "0"
    );
  }

  async setGarageTargetState(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Camera Garage Door] Setting Target State for ${this.mac} (${this.display_name}) to ${value}`
      );
    this.plugin.client.garageDoor(this.mac, this.product_model);
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
      this.plugin.config.alarmAccessory?.find((d) => d === this.mac) ||
      this.plugin.config.floodLightAccessory?.find((d) => d === this.mac) ||
      this.plugin.config.notificationAccessory?.find((d) => d === this.mac)
    );
  }
};
