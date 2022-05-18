const { Service, Characteristic } = require('../types');
const WyzeAccessory = require('./WyzeAccessory');

const HOMEBRIDGE_HUMIDITY_SERVICE = Service.HumiditySensor;
const HOMEBRIDGE_HUMIDITY_CHARACTERISTIC = Characteristic.CurrentRelativeHumidity;
const HOMEBRIDGE_TEMPERATURE_SERVICE = Service.TemperatureSensor;
const HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC = Characteristic.CurrentTemperature;

module.exports = class WyzeTemperatureHumidity extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getTemperatureCharacteristic();
    this.getHumidityCharacteristic();
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

  getHumidityCharacteristic() {
    this.plugin.log.debug(`[TemperatureHumidity] Fetching status of "${this.display_name}"`);
    return this.getHumiditySensorService().getCharacteristic(HOMEBRIDGE_HUMIDITY_CHARACTERISTIC);
  }

  getTemperatureCharacteristic() {
    this.plugin.log.debug(`[TemperatureHumidity] Fetching status of "${this.display_name}"`);
    return this.getTemperatureSensorService().getCharacteristic(HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC);
  }

  updateCharacteristics(device) {
    this.plugin.log.debug(`[TemperatureHumidity] Updating status of "${this.display_name}"`);
    this.getHumidityCharacteristic().updateValue(device.device_params.th_sensor_humidity);
    this.getTemperatureCharacteristic().updateValue((device.device_params.th_sensor_temperature-32.0)/1.8);
  }
};
