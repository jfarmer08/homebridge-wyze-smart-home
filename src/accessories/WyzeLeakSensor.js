const { Service, Characteristic } = require('../types');
const WyzeAccessory = require('./WyzeAccessory');

const HOMEBRIDGE_SERVICE = Service.LeakSensor;
const HOMEBRIDGE_CHARACTERISTIC = Characteristic.LeakDetected; 

module.exports = class WyzeHumidity extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getOnCharacteristic();
  }

  getSensorService() {
    this.plugin.log.debug(`[LeakSensor] Retrieving previous service for "${this.display_name}"`);
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE);

    if (!service) {
      this.plugin.log.debug(`[LeakSensor] Adding service for "${this.display_name}"`);
      service = this.homeKitAccessory.addService(HOMEBRIDGE_SERVICE);
    }

    return service;
  }

  getOnCharacteristic() {
    this.plugin.log.debug(`[LeakSensor] Fetching status of "${this.display_name}"`);
    return this.getSensorService().getCharacteristic(HOMEBRIDGE_CHARACTERISTIC);
  }

  async updateCharacteristics(device) {
    this.plugin.log.debug(`[HumiditySensor] Updating status of "${this.display_name}"`);
    this.getOnCharacteristic().updateValue(device.device_params.ws_detect_state);  
  }
  
};
