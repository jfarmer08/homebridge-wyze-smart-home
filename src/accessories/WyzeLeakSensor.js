const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

module.exports = class WyzeHumidity extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getOnCharacteristic();
    this.getStatusActiveCharacteristic();
    this.getBatteryCharacteristic();
    this.getIsBatteryLowCharacteristic();
  }

  getSensorService() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LeakSensor] Retrieving previous service for "${this.display_name}"`
      );
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

  getBatterySensorService() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LeakSensorBattery] Retrieving previous service for "${this.display_name}"`
      );
    let service = this.homeKitAccessory.getService(Service.Battery);

    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LeakSensorBattery] Adding service for "${this.display_name}"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }

    return service;
  }

  getIsBatteryLowSensorService() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LeakSensorBatteryLow] Retrieving previous service for "${this.display_name}"`
      );
    let service = this.homeKitAccessory.getService(Service.Battery);

    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LeakSensorIsBatteryLow] Adding service for "${this.display_name}"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }

    return service;
  }

  getStatusActiveCharacteristic() {
    return this.getSensorService().getCharacteristic(Characteristic.StatusActive);
  }

  getOnCharacteristic() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LeakSensor] Fetching status of "${this.display_name}"`
      );
    return this.getSensorService().getCharacteristic(
      Characteristic.LeakDetected
    );
  }

  getBatteryCharacteristic() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LeakSensorBattery] Fetching status of "${this.display_name}"`
      );
    return this.getBatterySensorService().getCharacteristic(
      Characteristic.BatteryLevel
    );
  }

  getIsBatteryLowCharacteristic() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[LeakSensorBattery] Fetching status of "${this.display_name}"`
      );
    return this.getIsBatteryLowSensorService().getCharacteristic(
      Characteristic.StatusLowBattery
    );
  }

  async updateCharacteristics(device) {
    const online = device.conn_state !== 0;
    this.getStatusActiveCharacteristic().updateValue(online);
    if (!online) {
      // StatusActive on the sensor service handles the offline indicator
      // (set above). Skip the leak-state update so the last known reading
      // stays visible instead of getting overwritten.
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[LeakSensor] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
    } else {
      if (this.plugin.config.pluginLoggingEnabled) {
        this.plugin.log(
          `[LeakSensor] Updating status of ${this.mac} (${this.display_name})`
        );
      }
      this.getOnCharacteristic().updateValue(
        this.plugin.client.getLeakSensorState(
          device.device_params.ws_detect_state
        )
      );
      this.getBatteryCharacteristic().updateValue(
        this.plugin.client.checkBatteryVoltage(device.device_params.voltage)
      );
      this.getIsBatteryLowCharacteristic().updateValue(
        this.plugin.client.checkLowBattery(device.device_params.voltage)
      );
    }
  }
};
