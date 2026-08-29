const { Service, Characteristic } = require("../types");
const { CommonModels } = require("../enums");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

// A "stateless programable switch" is a button that resets after pressing
// (think push button). Wyze exposes per-press-type routing via these enums.
const SinglePressType = {
  CLASSIC: 1, // Classic Control
  IOT: 2,     // Smart Control
};

module.exports = class WyzeSwitch extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.wallSwitch = this.homeKitAccessory.getService(Service.Switch);
    if (!this.wallSwitch) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Switch] Adding service for "${this.display_name} (${this.mac})"`);
      this.wallSwitch = this.homeKitAccessory.addService(Service.Switch);
    }

    // Restore last-known state from disk so the Get handler returns the
    // real value immediately on reboot instead of "undefined" while we
    // wait for the first refresh cycle to complete.
    const persisted = this.loadPersistedState();
    this.switch_power = persisted.switch_power;
    this.single_press_type = persisted.single_press_type;
    this.switch_iot = persisted.switch_iot;

    this.wallSwitch
      .getCharacteristic(Characteristic.On)
      .onGet(this.handleOnGetWallSwitch.bind(this))
      .onSet(this.handleOnSetWallSwitch.bind(this));
  }

  async updateCharacteristics(device) {
    const onlineFromList = device.conn_state !== 0;
    markServiceOnline(this.wallSwitch, onlineFromList);

    if (!onlineFromList) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Switch] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }

    // NOTE: this is one extra API call per switch per refresh cycle (on top
    // of the bulk getObjectList). The bulk list doesn't include switch-power
    // or any of the press-type properties, so we have to fetch them.
    let props;
    try {
      const propertyList = await this.plugin.client.getIotProp(this.mac);
      props = propertyList?.data?.props || {};

      if (
        this.plugin.config.pluginLoggingEnabled &&
        this.product_type === "Common" &&
        this.product_model !== CommonModels.LightSwitch
      ) {
        this.plugin.log(
          `[Switch] getIotProp payload for "${this.display_name} (${this.mac})": ${JSON.stringify(propertyList)}`
        );
      }
    } catch (error) {
      this.plugin.log.error?.(
        `[Switch] Failed to update "${this.display_name} (${this.mac})": ${error.message || error}`
      );
      markServiceOnline(this.wallSwitch, false);
      return;
    }

    for (const [prop, value] of Object.entries(props)) {
      switch (prop) {
        case "iot_state":          this.iot_state = value; break;
        case "single_press_type":  this.single_press_type = value; break;
        case "double_press_type":  this.double_press_type = value; break;
        case "triple_press_type":  this.triple_press_type = value; break;
        case "long_press_type":    this.long_press_type = value; break;
        case "switch-iot":         this.switch_iot = value; break;
        case "switch-power":
          this.switch_power = !!value;
          this.wallSwitch.getCharacteristic(Characteristic.On).updateValue(this.switch_power);
          break;
      }
    }

    // Persist so HomeKit gets the right value immediately after a reboot
    // instead of "undefined" until the first refresh.
    this.persistState({
      switch_power: this.switch_power,
      single_press_type: this.single_press_type,
      switch_iot: this.switch_iot,
    });

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Switch] ${this.mac} (${this.display_name}): ${this.switch_power ? "on" : "off"}`
      );
  }

  async handleOnGetWallSwitch() {
    // No log here on purpose — HomeKit calls onGet repeatedly per
    // characteristic (every iOS client + hub independently polls), so
    // logging would spam several lines per second per switch. State
    // changes are already logged in updateCharacteristics each refresh.
    return this.switch_power ?? false;
  }

  async handleOnSetWallSwitch(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Switch] Set "${this.display_name} (${this.mac})": ${value ? "on" : "off"}`
      );

    // Reflect the user's intent immediately — Wyze doesn't push a fast
    // state update back through the bulk list, so waiting for the next
    // poll would show a stale/reverted tile until the next refresh.
    this.switch_power = !!value;
    this.wallSwitch.getCharacteristic(Characteristic.On).updateValue(this.switch_power);

    const prefersIot = this.single_press_type == SinglePressType.IOT;

    const call = prefersIot
      ? this.plugin.client.wallSwitchIot(this.mac, this.product_model, !!value)
      : this.plugin.client.wallSwitchPower(this.mac, this.product_model, !!value);

    call.catch((error) => {
      this.plugin.log.error?.(
        `[Switch] Set failed for "${this.display_name} (${this.mac})": ${error.message || error}`
      );
    });
  }
};
