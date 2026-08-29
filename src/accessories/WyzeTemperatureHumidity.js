const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeTemperatureHumidity extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // Touch each characteristic once so HAP adds it to the service if missing.
    this.getTemperatureCharacteristic();
    this.getHumidityCharacteristic();
    this.getTemperatureStatusActiveCharacteristic();
    this.getHumidityStatusActiveCharacteristic();
    this.getBatteryCharacteristic();
    this.getIsBatteryLowCharacteristic();
  }

  getTemperatureSensorService() {
    let service = this.homeKitAccessory.getService(Service.TemperatureSensor);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[TemperatureHumidity] Adding Temperature service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.TemperatureSensor);
    }
    return service;
  }

  getHumiditySensorService() {
    let service = this.homeKitAccessory.getService(Service.HumiditySensor);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[TemperatureHumidity] Adding Humidity service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.HumiditySensor);
    }
    return service;
  }

  getBatteryService() {
    let service = this.homeKitAccessory.getService(Service.Battery);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[TemperatureHumidity] Adding Battery service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }
    return service;
  }

  getTemperatureCharacteristic() {
    return this.getTemperatureSensorService().getCharacteristic(Characteristic.CurrentTemperature);
  }

  getHumidityCharacteristic() {
    return this.getHumiditySensorService().getCharacteristic(Characteristic.CurrentRelativeHumidity);
  }

  getTemperatureStatusActiveCharacteristic() {
    return this.getTemperatureSensorService().getCharacteristic(Characteristic.StatusActive);
  }

  getHumidityStatusActiveCharacteristic() {
    return this.getHumiditySensorService().getCharacteristic(Characteristic.StatusActive);
  }

  getBatteryCharacteristic() {
    return this.getBatteryService().getCharacteristic(Characteristic.BatteryLevel);
  }

  getIsBatteryLowCharacteristic() {
    return this.getBatteryService().getCharacteristic(Characteristic.StatusLowBattery);
  }

  updateCharacteristics(device) {
    const online = device.conn_state !== 0;
    markServiceOnline(this.getTemperatureSensorService(), online);
    markServiceOnline(this.getHumiditySensorService(), online);

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[TemperatureHumidity] ${this.mac} (${this.display_name}) is offline — keeping last known values, marked inactive`
        );
      return;
    }
    if (!device.device_params) return;

    const tempC = this.plugin.client.wyzeTemperatureToHomeKit(device.device_params.th_sensor_temperature);
    const humidityPct = device.device_params.th_sensor_humidity;
    const batteryPct = this.plugin.client.checkBatteryVoltage(device.device_params.voltage);
    const batteryLow = this.plugin.client.checkLowBattery(device.device_params.voltage);

    this.getTemperatureCharacteristic().updateValue(tempC);
    this.getHumidityCharacteristic().updateValue(humidityPct);
    this.getBatteryCharacteristic().updateValue(batteryPct);
    this.getIsBatteryLowCharacteristic().updateValue(batteryLow);

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[TemperatureHumidity] ${this.mac} (${this.display_name}): ` +
          `${tempC.toFixed(1)}°C, ${humidityPct}% RH, ` +
          `battery ${batteryPct}%${batteryLow ? " (low)" : ""}`
      );
  }
};
