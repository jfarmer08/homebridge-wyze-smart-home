const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeMotionSensor extends WyzeAccessory {
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
    let service = this.homeKitAccessory.getService(Service.MotionSensor);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[MotionSensor] Adding service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.MotionSensor);
    }
    return service;
  }

  getBatteryService() {
    let service = this.homeKitAccessory.getService(Service.Battery);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[MotionSensor] [Battery] Adding service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }
    return service;
  }

  getOnCharacteristic() {
    return this.getSensorService().getCharacteristic(Characteristic.MotionDetected);
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
          `[MotionSensor] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }
    if (!device.device_params) return;

    // Wyze motion_state: 0 = no motion, 1 = motion detected.
    // HomeKit MotionDetected is a boolean — coerce explicitly.
    const motionDetected = device.device_params.motion_state === 1;
    const batteryPct = this.plugin.client.checkBatteryVoltage(device.device_params.voltage);
    const batteryLow = this.plugin.client.checkLowBattery(device.device_params.voltage);

    this.getOnCharacteristic().updateValue(motionDetected);
    this.getBatteryCharacteristic().updateValue(batteryPct);
    this.getIsBatteryLowCharacteristic().updateValue(batteryLow);

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MotionSensor] ${this.mac} (${this.display_name}): ` +
          `${motionDetected ? "MOTION" : "still"}, ` +
          `battery ${batteryPct}%${batteryLow ? " (low)" : ""}`
      );
  }
};
