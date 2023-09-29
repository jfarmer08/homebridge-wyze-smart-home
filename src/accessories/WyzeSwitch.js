const { Service,Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
//A stateless programable switch is button that resets after pressing (think push button).
const SinglePressType = {
  CLASSIC: 1, // Classic Control
  IOT: 2, // Smart Control
}

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeSwitch extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic().on('set', this.set.bind(this))
  }

  updateCharacteristics (device) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[WyzeSwitch] Updating status of "${this.display_name}"`)
    if (device.conn_state === 0) {
        this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.wallSwitchGetIotProp()
      this.getOnCharacteristic().updateValue((this.homeKitAccessory.context.device_params.switch_power) ? 1 : 0)
    }
  }

  getSwitchService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[WyzeSwitch] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(Service.Switch)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[WyzeSwitch] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(Service.Switch)
    }

    return service
  }

  getOnCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[WyzeSwitch] Fetching status of "${this.display_name}"`)
    return this.getSwitchService().getCharacteristic(Characteristic.On)
  }

  async set (value, callback) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[WyzeSwitch] Setting power for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    try {
      if ( this.single_press_type == SinglePressType.IOT){
        await this.plugin.client.wallSwitchIot(this.mac,this.product_model, (value) ? true : false)
      } else {
        await this.plugin.client.wallSwitchPower(this.mac,this.product_model, (value) ? true : false)
      }
      callback()
    } catch (e) {
      callback(e)
    }
  }
}
