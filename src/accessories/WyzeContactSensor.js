const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class WyzeContactSensor extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getOnCharacteristic();
    this.getBatteryCharacteristic();
    this.getIsBatteryLowCharacteristic();
  }

  getSensorService() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[ContactSensor] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
    let service = this.homeKitAccessory.getService(Service.ContactSensor);

    if (!service) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[ContactSensor] Adding service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.ContactSensor);
    }

    return service;
  }

  getBatterySensorService() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[ContactSensor] [Battery] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
    let service = this.homeKitAccessory.getService(Service.Battery);
    if (!service) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[ContactSensor] [Battery] Adding service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }

    return service;
  }

  getIsBatteryLowSensorService() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[ContactSensor] [Low Battery] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
    let service = this.homeKitAccessory.getService(Service.Battery);

    if (!service) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[ContactSensor] [Low Battery] Adding service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }

    return service;
  }

  getOnCharacteristic() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[ContactSensor] Fetching status of "${this.display_name} (${this.mac})"`
      );
    return this.getSensorService().getCharacteristic(
      Characteristic.ContactSensorState
    );
  }

  getBatteryCharacteristic() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[ContactSensor] [Battery] Fetching status of "${this.display_name} (${this.mac})"`
      );
    return this.getBatterySensorService().getCharacteristic(
      Characteristic.BatteryLevel
    );
  }

  getIsBatteryLowCharacteristic() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[ContactSensor] [Low Battery] Fetching status of "${this.display_name} (${this.mac})"`
      );
    return this.getIsBatteryLowSensorService().getCharacteristic(
      Characteristic.StatusLowBattery
    );
  }

  updateCharacteristics(device) {
    if (device.conn_state === 0) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[ContactSensor] Updating status "${this.display_name} (${this.mac}) to noResponse"`
        );
      this.getOnCharacteristic().updateValue(noResponse);
    } else {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[ContactSensor] Updating status of ${this.mac} (${this.display_name})`
        );
      this.getOnCharacteristic().updateValue(
        device.device_params.open_close_state
      );
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[ContactSensor] [Battery] Updating status of ${this.mac} (${
            this.display_name
          }) : ${this.plugin.client.checkBatteryVoltage(
            device.device_params.voltage
          )}`
        );
      this.getBatteryCharacteristic().updateValue(
        this.plugin.client.checkBatteryVoltage(device.device_params.voltage)
      );
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[ContactSensor] [Low Battery] Updating status of ${this.mac} (${
            this.display_name
          }) : ${this.plugin.client.checkLowBattery(
            device.device_params.voltage
          )}`
        );
      this.getIsBatteryLowCharacteristic().updateValue(
        this.plugin.client.checkLowBattery(device.device_params.voltage)
      );
    }
  }
};
