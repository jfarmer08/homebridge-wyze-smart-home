const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzePlug extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic().on('set', this.set.bind(this))
  }

  updateCharacteristics (device) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Plug] Updating status of "${this.display_name} (${this.mac})"`)
    if (device.conn_state === 0) {
      this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.getOnCharacteristic().updateValue(device.device_params.switch_state)
    }
  }

  getOutletService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Plug] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    let service = this.homeKitAccessory.getService(Service.Outlet)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Plug] Adding service for "${this.display_name} (${this.mac})"`)
      service = this.homeKitAccessory.addService(Service.Outlet)
    }

    return service
  }

  getOnCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Plug] Fetching status of "${this.display_name} (${this.mac})"`)
    return this.getOutletService().getCharacteristic(Characteristic.On)
  }

  async set (value, callback) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Plug] Setting power for "${this.display_name} (${this.mac})" to ${value}`)

    try {
      await this.plugin.client.plugPower(this.mac, this.product_model, (value) ? '1' : '0')
      callback()
    } catch (e) {
      callback(e)
    }
  }
}
