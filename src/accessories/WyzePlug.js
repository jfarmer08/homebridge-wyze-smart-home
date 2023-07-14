const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const WYZE_API_POWER_PROPERTY = 'P3'

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzePlug extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic().on('set', this.set.bind(this))
  }

  updateCharacteristics (device) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[WyzePlug] Updating status of "${this.display_name}"`)
    if (device.conn_state === 0) {
      this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.getOnCharacteristic().updateValue(device.device_params.switch_state)
    }
  }

  getOutletService () {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[WyzePlug] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(Service.Outlet)

    if (!service) {
      if(this.plugin.config.logging == "debug") this.plugin.log(`[WyzePlug] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(Service.Outlet)
    }

    return service
  }

  getOnCharacteristic () {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[WyzePlug] Fetching status of "${this.display_name}"`)
    return this.getOutletService().getCharacteristic(Characteristic.On)
  }

  async set (value, callback) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Setting power for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)

    try {
      await this.setProperty(WYZE_API_POWER_PROPERTY, (value) ? 1 : 0)
      callback()
    } catch (e) {
      callback(e)
    }
  }
}
