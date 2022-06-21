const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
const WyzeConstants = require('../WyzeConstants')

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzePlug extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic().on('set', this.set.bind(this))
  }

  updateCharacteristics (device) {
    if (device.conn_state === 0) {
      this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.getOnCharacteristic().updateValue(device.device_params.switch_state)
    }
  }

  getOutletService () {
    let service = this.homeKitAccessory.getService(Service.Outlet)

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Outlet)
    }

    return service
  }

  getOnCharacteristic () {
    return this.getOutletService().getCharacteristic(Characteristic.On)
  }

  async set (value, callback) {
    this.plugin.log.debug(`Setting power for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)

    try {
      await this.setProperty(WyzeConstants.WYZE_API_POWER_PROPERTY, (value) ? WyzeConstants.WYZE_PROPERTY_POWER_VALUE_ON : WyzeConstants.WYZE_PROPERTY_POWER_VALUE_OFF)
      callback()
    } catch (e) {
      callback(e)
    }
  }
}
