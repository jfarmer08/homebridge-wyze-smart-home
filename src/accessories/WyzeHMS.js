const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const homebridgeCharacteristic = {
  'home' : Characteristic.SecuritySystemTargetState.STAY_ARM,
  nightArm : Characteristic.SecuritySystemTargetState.NIGHT_ARM,
  'away' :Characteristic.SecuritySystemTargetState.AWAY_ARM,
  'disarm' : Characteristic.SecuritySystemTargetState.DISARM
}

const HMSMode = {
  CHANGING : 'changing',
  DISARMED : 'disarm',
  AWAY : 'away',
  HOME : 'home',
}

module.exports = class WyzeHMS extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    // create a new Security System service
    this.service = new this.Service(this.Service.SecuritySystem);

    // create handlers for required characteristics
    this.service.getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
      .onGet(this.handleSecuritySystemCurrentStateGet.bind(this));

    this.service.getCharacteristic(this.Characteristic.SecuritySystemTargetState)
      .onGet(this.handleSecuritySystemTargetStateGet.bind(this))
      .onSet(this.handleSecuritySystemTargetStateSet.bind(this));      
      this.Service = this.api.hap.Service;
      this.Characteristic = this.api.hap.Characteristic;

      // create a new Security System service
      this.service = new this.Service(this.Service.SecuritySystem);

      // create handlers for required characteristics
      this.service.getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
        .onGet(this.handleSecuritySystemCurrentStateGet.bind(this));

      this.service.getCharacteristic(this.Characteristic.SecuritySystemTargetState)
        .onGet(this.handleSecuritySystemTargetStateGet.bind(this))
        .onSet(this.handleSecuritySystemTargetStateSet.bind(this));

        //getHmsID() Get the ID and store it in the accessory
        //getHmsUpdate(hms_id) get id from the Accessory
  }

  /**
   * Handle requests to get the current value of the "Security System Current State" characteristic
   */
  handleSecuritySystemCurrentStateGet() {
    this.log.debug('Triggered GET SecuritySystemCurrentState');
    this.getHmsUpdate(hms_id) //get the ID from the accessory
    // set this to a valid value for SecuritySystemCurrentState
    const currentValue = this.Characteristic.SecuritySystemCurrentState.STAY_ARM;

    return currentValue;
  }


  /**
   * Handle requests to get the current value of the "Security System Target State" characteristic
   */
  handleSecuritySystemTargetStateGet() {
    this.log.debug('Triggered GET SecuritySystemTargetState');

    // set this to a valid value for SecuritySystemTargetState
    const currentValue = this.Characteristic.SecuritySystemTargetState.STAY_ARM;

    return currentValue;
  }

  /**
   * Handle requests to set the "Security System Target State" characteristic
   */
  handleSecuritySystemTargetStateSet(value) {
    this.log.debug('Triggered SET SecuritySystemTargetState:', value)
    setHMSCode(hms_id, mode) // get the ID from the access Get value and compare it to HMSModes
  }

}