const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

var switchPowerState = false
var iotState = "connected"
var singlePressType = 0

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeSwitch extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic().on('set', this.set.bind(this))
  }

  updateCharacteristics () {
    this.plugin.log.debug(`[WyzeSwitch] Updating status of "${this.display_name}"`)
    this.updateIotProp()
    if (iotState === "disconnected") {
        this.getOnCharacteristic().updateValue(noResponse)
    } else {
        this.getOnCharacteristic().updateValue((switchPowerState) ? 1 : 0)
    }
  }

  async updateIotProp() {
    const response = await this.wallSwitchGetIotProp()
    var properties = response.data.props

   const prop_key = Object.keys(properties);
   for (let i = 0; i < prop_key.length; i++) {
     const prop = prop_key[i];

    if (prop === 'iot_state') {
        iotState = properties[prop]
        } else if (prop == 'single_press_type') {
        singlePressType = properties[prop]
        } else {
        if (prop == 'switch-power'){
            switchPowerState = properties[prop]
        } 
    }
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
      await this.power_onoff((value) ? true : false)
      callback()
    } catch (e) {
      callback(e)
    }
  }
}
