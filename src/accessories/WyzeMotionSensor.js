const { Service, Characteristic } = require('../types');
const WyzeAccessory = require('./WyzeAccessory');

const HOMEBRIDGE_SERVICE = Service.MotionSensor;
const HOMEBRIDGE_CHARACTERISTIC = Characteristic.MotionDetected;

module.exports = class WyzeMotionSensor extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getOnCharacteristic();
  }

  getSensorService() {
<<<<<<< Updated upstream
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE);

    if (!service) {
=======
<<<<<<< Updated upstream
    this.plugin.log.debug(`[MotionSensor] Retrieving previous service for "${this.display_name}"`);
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE);

    if (!service) {
      this.plugin.log.debug(`[MotionSensor] Adding service for "${this.display_name}"`);
=======
    //this.plugin.log.debug(`[MotionSensor] Retrieving previous service for "${this.display_name}"`);
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE);

    if (!service) {
      //this.plugin.log.debug(`[MotionSensor] Adding service for "${this.display_name}"`);
>>>>>>> Stashed changes
>>>>>>> Stashed changes
      service = this.homeKitAccessory.addService(HOMEBRIDGE_SERVICE);
    }

    return service;
  }

  getOnCharacteristic() {
<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
    this.plugin.log.debug(`[MotionSensor] Fetching status of "${this.display_name}"`);
=======
    //this.plugin.log.debug(`[MotionSensor] Fetching status of "${this.display_name}"`);
>>>>>>> Stashed changes
>>>>>>> Stashed changes
    return this.getSensorService().getCharacteristic(HOMEBRIDGE_CHARACTERISTIC);
  }

  updateCharacteristics(device) {
<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
    this.plugin.log.debug(`[MotionSensor] Updating status of "${this.display_name}"`);
=======
    //this.plugin.log.debug(`[MotionSensor] Updating status of "${this.display_name}"`);
>>>>>>> Stashed changes
>>>>>>> Stashed changes
    this.getOnCharacteristic().updateValue(device.device_params.motion_state);
  }
};
