const { Service, Characteristic } = require('../types');
const WyzeAccessory = require('./WyzeAccessory');

const HOMEBRIDGE_SERVICE = Service.TemperatureSensor;
const HOMEBRIDGE_CHARACTERISTIC = Characteristic.CurrentTemperature; 

module.exports = class WyzeTemperature extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getOnCharacteristic();
  }

  getSensorService() {
    this.plugin.log.debug(`[TemperatureSensor] Retrieving previous service for "${this.display_name}"`);
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE);

    if (!service) {
      this.plugin.log.debug(`[TemperatureSensor] Adding service for "${this.display_name}"`);
      service = this.homeKitAccessory.addService(HOMEBRIDGE_SERVICE);
    }

    return service;
  }

  getOnCharacteristic() {
    this.plugin.log.debug(`[TemperatureSensor] Fetching status of "${this.display_name}"`);
    return this.getSensorService().getCharacteristic(HOMEBRIDGE_CHARACTERISTIC);
  }

  async updateCharacteristics(device) {
    this.plugin.log.debug(`[TemperatureSensor] Updating status of "${this.display_name}"`);
    let celsius = ((device.device_params.th_sensor_temperature-32)*5)/9;
    this.getOnCharacteristic().updateValue(celsius);  
  }
  
};
