const { Service,Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const SinglePressType = {
  CLASSIC: 1,
  IOT: 2,
}

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeSwitch extends WyzeAccessory {
  constructor (plugin, homeKitAccessory,PlatformAccessory) {
    super(plugin, homeKitAccessory)

    this.wallSwitchGetIotProp()
    this.getOnCharacteristic().on('set', this.set.bind(this))    
  }

  updateCharacteristics () {
    this.wallSwitchGetIotProp()
    this.plugin.log.debug(`[WyzeSwitch] Updating status of "${this.display_name}"`)
    if (this.iot_state === "disconnected") {
        this.getOnCharacteristic().updateValue(noResponse)
    } else {
        this.getOnCharacteristic().updateValue((Number(this.switch_power)) ? 1 : 0)
    }
  }

  getSwitchService () {
    this.plugin.log.debug(`[WyzeSwitch] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(Service.Switch)

    if (!service) {
      this.plugin.log.debug(`[WyzeSwitch] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(Service.Switch)
    }

    return service
  }

  getOnCharacteristic () {
    this.plugin.log.debug(`[WyzeSwitch] Fetching status of "${this.display_name}"`)
    return this.getSwitchService().getCharacteristic(Characteristic.On)
  }

  async set (value, callback) {
    this.plugin.log.debug(`Setting power for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    try {
      if ( this.single_press_type == SinglePressType.IOT){
        await this.iot_onoff((value) ? true : false)
      } else {
        await this.power_onoff((value) ? true : false)
      }
      callback()
    } catch (e) {
      callback(e)
    }
  }
}
