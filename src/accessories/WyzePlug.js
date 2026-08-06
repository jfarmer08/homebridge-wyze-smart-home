const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzePlug extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // Restore from disk so OutletInUse Get returns the right value on
    // reboot instead of false (the JS-default for an undefined ?? false).
    const persisted = this.loadPersistedState();
    this.outletInUse = persisted.outletInUse;

    this.getOnCharacteristic()
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));
    this.getOutletService()
      .getCharacteristic(Characteristic.OutletInUse)
      .onGet(this.getOutletInUse.bind(this));
  }

  async getOn() {
    return this._switchState === 1;
  }

  async setOn(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Plug] Setting power for "${this.display_name} (${this.mac})" to ${value}`
      );
    this._switchState = value ? 1 : 0;
    this.outletInUse = !!value;
    this.getOutletService()
      .getCharacteristic(Characteristic.OutletInUse)
      .updateValue(this.outletInUse);
    this.persistState({ outletInUse: this.outletInUse });
    this.armCommandGrace(15000);
    this.plugin.client.plugPower(this.mac, this.product_model, value ? "1" : "0").catch((e) => {
      this.clearCommandGrace();
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Plug] Command error for "${this.display_name}": ${e}`);
    });
  }

  getOutletService() {
    let service = this.homeKitAccessory.getService(Service.Outlet);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Plug] Adding service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.Outlet);
    }
    return service;
  }

  getOnCharacteristic() {
    return this.getOutletService().getCharacteristic(Characteristic.On);
  }

  async getOutletInUse() {
    return this.outletInUse ?? false;
  }

  updateCharacteristics(device) {
    const online = device.conn_state !== 0;
    markServiceOnline(this.getOutletService(), online);

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Plug] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }
    if (!device.device_params) return;

    // Wyze switch_state: 0 = off, 1 = on. Coerce explicitly.
    // Skip while a just-issued command's grace period is active, or if
    // the state hasn't actually changed — avoids reverting the optimistic
    // UI update before Wyze's API has propagated the change, and avoids
    // redundant pushes/log lines every poll.
    const switchState = device.device_params.switch_state;
    if (switchState === this._switchState || this.inCommandGrace()) return;
    this._switchState = switchState;

    const isOn = switchState === 1;
    this.outletInUse = isOn;
    this.getOnCharacteristic().updateValue(isOn);
    this.getOutletService()
      .getCharacteristic(Characteristic.OutletInUse)
      .updateValue(isOn);
    this.persistState({ outletInUse: isOn });

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Plug] ${this.mac} (${this.display_name}): ${isOn ? "on" : "off"}`
      );
  }
};
