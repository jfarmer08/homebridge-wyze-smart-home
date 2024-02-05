const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class WyzeHumidity extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getOnCharacteristic();
    this.getBatteryCharacteristic();
    this.getIsBatteryLowCharacteristic();
  }

  getSensorService() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[LeakSensor] Retrieving previous service for "${this.display_name}"`
      );
    let service = this.homeKitAccessory.getService(Service.LeakSensor);

    if (!service) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[LeakSensor] Adding service for "${this.display_name}"`
        );
      service = this.homeKitAccessory.addService(Service.LeakSensor);
    }

    return service;
  }

  getBatterySensorService() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[LeakSensorBattery] Retrieving previous service for "${this.display_name}"`
      );
    let service = this.homeKitAccessory.getService(Service.Battery);

    if (!service) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[LeakSensorBattery] Adding service for "${this.display_name}"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }

    return service;
  }

  getIsBatteryLowSensorService() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[LeakSensorBatteryLow] Retrieving previous service for "${this.display_name}"`
      );
    let service = this.homeKitAccessory.getService(Service.Battery);

    if (!service) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[LeakSensorIsBatteryLow] Adding service for "${this.display_name}"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }

    return service;
  }

  getOnCharacteristic() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[LeakSensor] Fetching status of "${this.display_name}"`
      );
    return this.getSensorService().getCharacteristic(
      Characteristic.LeakDetected
    );
  }

  getBatteryCharacteristic() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[LeakSensorBattery] Fetching status of "${this.display_name}"`
      );
    return this.getBatterySensorService().getCharacteristic(
      Characteristic.BatteryLevel
    );
  }

  getIsBatteryLowCharacteristic() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[LeakSensorBattery] Fetching status of "${this.display_name}"`
      );
    return this.getIsBatteryLowSensorService().getCharacteristic(
      Characteristic.StatusLowBattery
    );
  }

  async updateCharacteristics(device) {
    if (device.conn_state === 0) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[LeakSensor] Updating status ${this.mac} (${this.display_name}) to noResponse`
        );
      this.getOnCharacteristic().updateValue(noResponse);
    } else {
      if (this.plugin.config.logLevel == "debug") {
        this.plugin.log.info(
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
