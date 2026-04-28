const { Service, Characteristic } = require("../types");
const { CommonModels } = require("../enums");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");
//A stateless programable switch is button that resets after pressing (think push button).
const SinglePressType = {
  CLASSIC: 1, // Classic Control
  IOT: 2, // Smart Control
};

module.exports = class WyzeSwitch extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // create a new Switch service
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Switch] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
    this.wallSwitch = this.homeKitAccessory.getService(Service.Switch);

    if (!this.wallSwitch) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Switch] Adding service for "${this.display_name} (${this.mac})"`
        );
      this.wallSwitch = this.homeKitAccessory.addService(Service.Switch);
    }

    this.wallSwitch
      .getCharacteristic(Characteristic.On)
      .onGet(this.handleOnGetWallSwitch.bind(this))
      .onSet(this.handleOnSetWallSwitch.bind(this));
  }

  async updateCharacteristics(device) {
    markServiceOnline(this.wallSwitch, device.conn_state !== 0);
    if (device.conn_state === 0) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Switch] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
    } else {
      try {
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Switch] Updating status of "${this.display_name} (${this.mac})"`
          );
        const propertyList = await this.plugin.client.getIotProp(this.mac);
        const props = propertyList?.data?.props || {};

        if (
          this.plugin.config.pluginLoggingEnabled &&
          this.product_type === "Common" &&
          this.product_model !== CommonModels.LightSwitch
        ) {
          this.plugin.log(
            `[Switch] getIotProp payload for "${this.display_name} (${this.mac})": ${JSON.stringify(propertyList)}`
          );
        }

        for (const prop of Object.keys(props)) {
          switch (prop) {
            case "iot_state":
              this.iot_state = props[prop];
              break;
            case "single_press_type":
              this.single_press_type = props[prop];
              break;
            case "double_press_type":
              this.double_press_type = props[prop];
              break;
            case "triple_press_type":
              this.triple_press_type = props[prop];
              break;
            case "long_press_type":
              this.long_press_type = props[prop];
              break;
            case "switch-power":
              this.wallSwitch
                .getCharacteristic(Characteristic.On)
                .updateValue(props[prop]);
              this.switch_power = props[prop];
              break;
            case "switch-iot":
              this.switch_iot = props[prop];
              break;
            case "palm-state":
              // Palm reports as boolean or 0/1 for power, but default to false for safety
              const palmState = props[prop];
              this.switch_power = palmState === undefined ? false : !!palmState;
              this.wallSwitch
                .getCharacteristic(Characteristic.On)
                .updateValue(this.switch_power);
              break;
          }
        }

        if (
          this.product_model === CommonModels.Palm &&
          this.switch_power === undefined
        ) {
          this.switch_power = false;
          this.wallSwitch
            .getCharacteristic(Characteristic.On)
            .updateValue(this.switch_power);
        }
      } catch (error) {
        this.plugin.log.error?.(
          `[Switch] Failed to update "${this.display_name} (${this.mac})": ${error}`
        );
        // API call failed even though device shows online — flip StatusActive
        // to false until we get a successful read.
        markServiceOnline(this.wallSwitch, false);
      }
    }
  }

  async handleOnGetWallSwitch() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Switch] Getting Current State of "${this.display_name} (${this.mac})" : "${this.switch_power}"`
      );
    return this.switch_power;
  }

  async handleOnSetWallSwitch(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Switch] Target State Set "${this.display_name} (${this.mac})" : "${value}"`
      );
    try {
      if (this.product_model === CommonModels.Palm) {
        const prefersIot =
          this.single_press_type == SinglePressType.IOT ||
          this.switch_iot !== undefined;

        if (prefersIot) {
          await this.plugin.client.wallSwitchIot(
            this.mac,
            this.product_model,
            value ? true : false
          );
        } else {
          await this.plugin.client.wallSwitchPower(
            this.mac,
            this.product_model,
            value ? true : false
          );
        }

        this.switch_power = !!value;
        this.wallSwitch
          .getCharacteristic(Characteristic.On)
          .updateValue(this.switch_power);
      } else if (this.single_press_type == SinglePressType.IOT) {
        await this.plugin.client.wallSwitchIot(
          this.mac,
          this.product_model,
          value ? true : false
        );
      } else {
        await this.plugin.client.wallSwitchPower(
          this.mac,
          this.product_model,
          value ? true : false
        );
      }
    } catch (error) {
      this.plugin.log.error?.(
        `[Switch] Failed to set target state for "${this.display_name} (${this.mac})": ${error}`
      );
      throw error;
    }
  }
};
