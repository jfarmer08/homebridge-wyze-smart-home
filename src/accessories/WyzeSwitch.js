const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./services/WyzeAccessory')

const WYZE_API_POWER_PROPERTY = 'P3'

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeSwitch extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic().on('set', this.set.bind(this))
  }

  updateCharacteristics (device) {
    this.plugin.log.debug(`[WyzeSwitch] Updating status of "${this.display_name}"`)
    this.wallSwitchGetIotProp()
 //   if (device.conn_state === 0) {
     //   this.getOnCharacteristic().updateValue(noResponse)
  //  } else {
       // this.getOnCharacteristic().updateValue(device.device_params.switch_state)
  //  }
  }

  async wallSwitchGetIotProp() {
    var keys = "iot_state,switch-power,switch-iot,single_press_type"
    const response = await this.plugin.client.getIotProp(this.mac, keys)
    var properties = response.data.props
    var device_props = []

   const prop_key = Object.keys(properties);
   for (let i = 0; i < prop_key.length; i++) {
     const prop = prop_key[i];

     if (prop === 'iot_state') {
        if (properties[prop] === 'disconnected') {
            console.log("Offline")
        }
        } else if (prop == 'single_press_type') {

        }else {
            if (prop == 'switch-power'){
                if(properties[prop] === false) {
                    console.log("light is off")
                }
            } 
            else {
                console.log("light is on")
            }
           
       }
     device_props.push(prop, properties[prop])

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
      await this.setIotPropSwitchPower((value) ? true : false)
      callback()
    } catch (e) {
      callback(e)
    }
  }
}
