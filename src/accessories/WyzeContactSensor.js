const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeContactSensor extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // Touch each characteristic once so HAP adds it to the service if
    // missing. Subsequent calls return the existing characteristic.
    this.getOnCharacteristic();
    this.getStatusActiveCharacteristic();
    this.getBatteryCharacteristic();
    this.getIsBatteryLowCharacteristic();
  }

  getSensorService() {
    let service = this.homeKitAccessory.getService(Service.ContactSensor);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[ContactSensor] Adding service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.ContactSensor);
    }
    return service;
  }

  getBatteryService() {
    let service = this.homeKitAccessory.getService(Service.Battery);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[ContactSensor] [Battery] Adding service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }
    return service;
  }

  getOnCharacteristic() {
    return this.getSensorService().getCharacteristic(Characteristic.ContactSensorState);
  }

  getStatusActiveCharacteristic() {
    return this.getSensorService().getCharacteristic(Characteristic.StatusActive);
  }

  getBatteryCharacteristic() {
    return this.getBatteryService().getCharacteristic(Characteristic.BatteryLevel);
  }

  getIsBatteryLowCharacteristic() {
    return this.getBatteryService().getCharacteristic(Characteristic.StatusLowBattery);
  }

  updateCharacteristics(device) {
    const online = device.conn_state !== 0;
    markServiceOnline(this.getSensorService(), online);

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[ContactSensor] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }

    // Wyze open_close_state: 0 = closed, 1 = open. HomeKit's
    // ContactSensorState happens to use the same numbers but we map
    // explicitly so a future Wyze API change can't silently invert it.
    const contactState =
      device.device_params.open_close_state === 0
        ? Characteristic.ContactSensorState.CONTACT_DETECTED
        : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
    const batteryPct = this.plugin.client.checkBatteryVoltage(device.device_params.voltage);
    const batteryLow = this.plugin.client.checkLowBattery(device.device_params.voltage);

    this.getOnCharacteristic().updateValue(contactState);
    this.getBatteryCharacteristic().updateValue(batteryPct);
    this.getIsBatteryLowCharacteristic().updateValue(batteryLow);

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[ContactSensor] ${this.mac} (${this.display_name}): ` +
          `${contactState === Characteristic.ContactSensorState.CONTACT_DETECTED ? "closed" : "open"}, ` +
          `battery ${batteryPct}%${batteryLow ? " (low)" : ""}`
      );
  }
};
