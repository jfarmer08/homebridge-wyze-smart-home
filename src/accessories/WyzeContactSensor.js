const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

module.exports = class WyzeContactSensor extends WyzeAccessory {
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
        `[ContactSensor] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
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

  getBatterySensorService() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[ContactSensor] [Battery] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
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

  getIsBatteryLowSensorService() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[ContactSensor] [Low Battery] Retrieving previous service for "${this.display_name} (${this.mac})"`
      );
    let service = this.homeKitAccessory.getService(Service.Battery);

    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[ContactSensor] [Low Battery] Adding service for "${this.display_name} (${this.mac})"`
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
        `[ContactSensor] Fetching status of "${this.display_name} (${this.mac})"`
      );
    return this.getSensorService().getCharacteristic(
      Characteristic.ContactSensorState
    );
  }

  getBatteryCharacteristic() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[ContactSensor] [Battery] Fetching status of "${this.display_name} (${this.mac})"`
      );
    return this.getBatterySensorService().getCharacteristic(
      Characteristic.BatteryLevel
    );
  }

  getIsBatteryLowCharacteristic() {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[ContactSensor] [Low Battery] Fetching status of "${this.display_name} (${this.mac})"`
      );
    return this.getIsBatteryLowSensorService().getCharacteristic(
      Characteristic.StatusLowBattery
    );
  }

  updateCharacteristics(device) {
    const online = device.conn_state !== 0;
    this.getStatusActiveCharacteristic().updateValue(online);
    if (!online) {
      // StatusActive on the sensor service (set above) handles the offline
      // indicator. Skip the contact-state update so the last known reading
      // stays visible instead of getting overwritten.
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[ContactSensor] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
    } else {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[ContactSensor] Updating status of ${this.mac} (${this.display_name})`
        );
      this.getOnCharacteristic().updateValue(
        device.device_params.open_close_state
      );
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[ContactSensor] [Battery] Updating status of ${this.mac} (${
            this.display_name
          }) : ${this.plugin.client.checkBatteryVoltage(
            device.device_params.voltage
          )}`
        );
      this.getBatteryCharacteristic().updateValue(
        this.plugin.client.checkBatteryVoltage(device.device_params.voltage)
      );
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
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
