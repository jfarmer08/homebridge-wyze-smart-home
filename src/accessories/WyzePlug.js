const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzePlug extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getOnCharacteristic().on("set", this.set.bind(this));
    this.getOutletService()
      .getCharacteristic(Characteristic.OutletInUse)
      .onGet(this.getOutletInUse.bind(this));
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

    // Wyze switch_state: 0 = off, 1 = on. Coerce explicitly.
    const isOn = device.device_params.switch_state === 1;
    this.outletInUse = isOn;
    this.getOnCharacteristic().updateValue(isOn);
    this.getOutletService()
      .getCharacteristic(Characteristic.OutletInUse)
      .updateValue(isOn);

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Plug] ${this.mac} (${this.display_name}): ${isOn ? "on" : "off"}`
      );
  }

  async set(value, callback) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Plug] Setting power for "${this.display_name} (${this.mac})" to ${value ? "on" : "off"}`
      );
    try {
      await this.plugin.client.plugPower(
        this.mac,
        this.product_model,
        value ? "1" : "0"
      );
      callback();
    } catch (e) {
      this.plugin.log.error(
        `[Plug] Set failed for "${this.display_name}": ${e.message || e}`
      );
      callback(e);
    }
  }
};
