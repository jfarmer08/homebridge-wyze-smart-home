const { Service, Characteristic } = require('../types');
const WyzeAccessory = require('./WyzeAccessory');

const HOMEBRIDGE_HUMIDITY_SERVICE = Service.HumiditySensor;
const HOMEBRIDGE_HUMIDITY_CHARACTERISTIC = Characteristic.CurrentRelativeHumidity;
const HOMEBRIDGE_TEMPERATURE_SERVICE = Service.TemperatureSensor;
const HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC = Characteristic.CurrentTemperature;
const HOMEBRIDGE_BATTERY_SERVICE = Service.Battery;
const HOMEBRIDGE_BATTERY_CHARACTERISTIC = Characteristic.BatteryLevel
const HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC = Characteristic.StatusLowBattery

module.exports = class WyzeTemperatureHumidity extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getTemperatureCharacteristic();
    this.getHumidityCharacteristic();
    this.getBatteryCharacteristic();
    this.getIsBatteryLowCharacteristic();
  }

  getHumiditySensorService() {
    this.plugin.log.debug(`[TemperatureHumidity] Retrieving previous service for "${this.display_name}"`);
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_HUMIDITY_SERVICE);

    if (!service) {
      this.plugin.log.debug(`[TemperatureHumidity] Adding service for "${this.display_name}"`);
      service = this.homeKitAccessory.addService(HOMEBRIDGE_HUMIDITY_SERVICE);
    }

    return service;
  }

  getTemperatureSensorService() {
    this.plugin.log.debug(`[TemperatureHumidity] Retrieving previous service for "${this.display_name}"`);
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_TEMPERATURE_SERVICE);

    if (!service) {
      this.plugin.log.debug(`[TemperatureHumidity] Adding service for "${this.display_name}"`);
      service = this.homeKitAccessory.addService(HOMEBRIDGE_TEMPERATURE_SERVICE);
    }

    return service;
  }

  getBatterySensorService() {
    this.plugin.log.debug(`[TemperatureHumidityBattery] Retrieving previous service for "${this.display_name}"`);
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE);

    if (!service) {
      this.plugin.log.debug(`[TemperatureHumidityBattery] Adding service for "${this.display_name}"`);
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE);
    }

    return service;
  }

  getIsBatteryLowSensorService() {
    this.plugin.log.debug(`[TemperatureHumidityIsBatteryLow] Retrieving previous service for "${this.display_name}"`);
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE);

    if (!service) {
      this.plugin.log.debug(`[TemperatureHumidityIsBatteryLow] Adding service for "${this.display_name}"`);
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE);
    }

    return service;
  }

  getHumidityCharacteristic() {
    this.plugin.log.debug(`[TemperatureHumidity] Fetching status of "${this.display_name}"`);
    return this.getHumiditySensorService().getCharacteristic(HOMEBRIDGE_HUMIDITY_CHARACTERISTIC);
  }

  getTemperatureCharacteristic() {
    this.plugin.log.debug(`[TemperatureHumidity] Fetching status of "${this.display_name}"`);
    return this.getTemperatureSensorService().getCharacteristic(HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC);
  }

  getBatteryCharacteristic() {
    this.plugin.log.debug(`[TemperatureHumidityBattery] Fetching status of "${this.display_name}"`);
    return this.getBatterySensorService().getCharacteristic(HOMEBRIDGE_BATTERY_CHARACTERISTIC);
  }

  getIsBatteryLowCharacteristic() {
    this.plugin.log.debug(`[TemperatureHumidityBattery] Fetching status of "${this.display_name}"`);
    return this.getIsBatteryLowSensorService().getCharacteristic(HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC);
  }

  updateCharacteristics(device) {
    this.plugin.log.debug(`[TemperatureHumidity] Updating status of "${this.display_name}"`);
    this.getHumidityCharacteristic().updateValue(device.device_params.th_sensor_humidity);
    this.getTemperatureCharacteristic().updateValue((device.device_params.th_sensor_temperature-32.0)/1.8);
    this.getBatteryCharacteristic().updateValue(this.getBatteryVoltage(device.device_params.voltage));
    this.getIsBatteryLowCharacteristic().updateValue(device.device_params.is_low_battery);
  }

  getBatteryVoltage(deviceVoltage){
    if(deviceVoltage >= 100)
    {
      return 100
    }
    else{return deviceVoltage}
  }
};
