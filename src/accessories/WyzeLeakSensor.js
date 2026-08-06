const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeLeakSensor extends WyzeAccessory {
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
    let service = this.homeKitAccessory.getService(Service.LeakSensor);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LeakSensor] Adding service for "${this.display_name}"`
        );
      service = this.homeKitAccessory.addService(Service.LeakSensor);
    }
    return service;
  }

  getBatteryService() {
    let service = this.homeKitAccessory.getService(Service.Battery);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LeakSensor] [Battery] Adding service for "${this.display_name}"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }
    return service;
  }

  getOnCharacteristic() {
    return this.getSensorService().getCharacteristic(Characteristic.LeakDetected);
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

  async updateCharacteristics(device) {
    const online = device.conn_state !== 0;
    markServiceOnline(this.getSensorService(), online);

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LeakSensor] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }
    if (!device.device_params) return;

    // Wyze ws_detect_state: 0 = dry, 1 = wet. The helper also collapses
    // any unknown value (>= 2) to "leak detected" as a fail-safe — better
    // a false alarm than missing a real leak on a safety device.
    const leakState = this.plugin.client.getLeakSensorState(device.device_params.ws_detect_state);
    const batteryPct = this.plugin.client.checkBatteryVoltage(device.device_params.voltage);
    const batteryLow = this.plugin.client.checkLowBattery(device.device_params.voltage);

    this.getOnCharacteristic().updateValue(leakState);
    this.getBatteryCharacteristic().updateValue(batteryPct);
    this.getIsBatteryLowCharacteristic().updateValue(batteryLow);

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LeakSensor] ${this.mac} (${this.display_name}): ` +
          `${leakState === Characteristic.LeakDetected.LEAK_DETECTED ? "WET" : "dry"}, ` +
          `battery ${batteryPct}%${batteryLow ? " (low)" : ""}`
      );
  }
};
