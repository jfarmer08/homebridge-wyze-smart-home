const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

module.exports = class WyzeHMS extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    // create a new Security System service
    let securityService = this.homeKitAccessory.getService(Service.SecuritySystem) ||
      this.homeKitAccessory.addService(Service.SecuritySystem)

    // create handlers for required characteristics
    securityService.getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .onGet(this.handleSecuritySystemCurrentStateGet.bind(this));

    securityService.getCharacteristic(Characteristic.SecuritySystemTargetState)
      .onGet(this.handleSecuritySystemTargetStateGet.bind(this))
      .onSet(this.handleSecuritySystemTargetStateSet.bind(this)) 
  }

  async updateCharacteristics (device) {
    this.plugin.log.debug(`[HMS] Updating Current State of "${this.display_name}" is "${this.hmsStatus}"`)
    if (device.conn_state === 0) {
      this.getCharacteristic(Characteristic.On).updateValue(noResponse)
    } else {
      if (this.hmsHmsID == null) {
        await this.getHmsID()
        await this.getHmsUpdate(this.hmsHmsID)
        this.handleSecuritySystemCurrentStateGet()
      }else {
        await this.getHmsUpdate(this.hmsHmsID)
        await this.handleSecuritySystemCurrentStateGet()
      }
    }
  }

  /**
   * Handle requests to get the current value of the "Security System Current State" characteristic
   */
  handleSecuritySystemCurrentStateGet() {
    this.plugin.log.debug(`[HMS] Fetching Current State of "${this.display_name}": "${this.hmsStatus}"`)
    return this.convertHmsStateToHomeKitState(this.hmsStatus);
  }

  /**
   * Handle requests to get the current value of the "Security System Target State" characteristic
   */
  async handleSecuritySystemTargetStateGet() {
    this.plugin.log.debug(`[HMS] Fetching Target State of "${this.display_name}": "${this.hmsStatus}"`)
  //   if(this.plugin.config.hasOwnProperty('entryExitDelay')){
  //   while(this.hmsStatus == "changing") {
  //     if (this.hmsHmsID == null) {
  //       await this.getHmsID()
  //       await this.getHmsUpdate(this.hmsHmsID)
  //       this.sleep(this.plugin.config.entryExitDelay)
  //     }else {
  //       await this.getHmsUpdate(this.hmsHmsID)
  //       this.sleep(this.plugin.config.entryExitDelay)
  //     }
  //   }
  // }
    
    // set this to a valid value for SecuritySystemTargetState
    return this.convertHmsStateToHomeKitState(this.hmsStatus);
  }

  /**
   * Handle requests to set the "Security System Target State" characteristic
   */
  async handleSecuritySystemTargetStateSet(value) {
    this.plugin.log.debug(`[HMS] Target State Set "${this.display_name}": "${this.convertHomeKitStateToHmsState(value)}"`)
    await this.setHMSState(this.hmsHmsID,this.convertHomeKitStateToHmsState(value))
  }

  convertHmsStateToHomeKitState(hmsState) {
    switch (hmsState) {
        case "home":
            return Characteristic.SecuritySystemTargetState.STAY_ARM;
            break;
        case "away":
            return Characteristic.SecuritySystemTargetState.AWAY_ARM;
            break;
        case "disarm":
            return Characteristic.SecuritySystemTargetState.DISARM;
            break;
    }
  }
  convertHomeKitStateToHmsState(homeKitState) {
    switch (homeKitState) {
        case Characteristic.SecuritySystemTargetState.STAY_ARM:
        case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
            return "home";
            break;
        case Characteristic.SecuritySystemTargetState.AWAY_ARM :
            return "away";
            break;
        case Characteristic.SecuritySystemTargetState.DISARM:
            return "off";
            break;
        case Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED:
          return ""
          break;
    }
  }

  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms * 1000))
  }
}