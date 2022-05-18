const { Service, Characteristic } = require('../types');
const WyzeAccessory = require('./WyzeAccessory');

const WYZE_API_POWER_PROPERTY = 'P3';

module.exports = class WyzePlug extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getOnCharacteristic().on('set', this.set.bind(this));
  }

  updateCharacteristics(device) {
    this.getOnCharacteristic().updateValue(device.device_params.switch_state);
  }

  getOutletService() {
    let service = this.homeKitAccessory.getService(Service.Outlet);

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Outlet);
    }

    return service;
  }

  getOnCharacteristic() {
    return this.getOutletService().getCharacteristic(Characteristic.On);
  }

  async set(value, callback) {
    this.plugin.log.debug(`Setting power for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`);

    try {
      await this.setProperty(WYZE_API_POWER_PROPERTY, (value) ? '1' : '0');
      callback();
    } catch (e) {
      callback(e);
    }
  }
};
