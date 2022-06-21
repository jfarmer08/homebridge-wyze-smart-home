const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
const WyzeConstants = require('../WyzeConstants')

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeLight extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getCharacteristic(Characteristic.On).on('set', this.setOn.bind(this))
    this.getCharacteristic(Characteristic.Brightness).on('set', this.setBrightness.bind(this))
    this.getCharacteristic(Characteristic.ColorTemperature).on('set', this.setColorTemperature.bind(this))
  }

  async updateCharacteristics (device) {
    if (device.conn_state === 0) {
      this.getCharacteristic(Characteristic.On).updateValue(noResponse)
    } else {
      this.getCharacteristic(Characteristic.On).updateValue(device.device_params.switch_state)

      const propertyList = await this.getPropertyList()
      for (const property of propertyList.data.property_list) {
        switch (property.pid) {
          case WyzeConstants.WYZE_API_BRIGHTNESS_PROPERTY:
            this.updateBrightness(property.value)
            break

          case WyzeConstants.WYZE_API_COLOR_TEMP_PROPERTY:
            this.updateColorTemp(property.value)
            break
        }
      }
    }
  }

  updateBrightness (value) {
    this.getCharacteristic(Characteristic.Brightness).updateValue(value)
  }

  updateColorTemp (value) {
    const floatValue = this._rangeToFloat(value, WyzeConstants.WYZE_COLOR_TEMP_MIN, WyzeConstants.WYZE_COLOR_TEMP_MAX)
    const homeKitValue = this._floatToRange(floatValue, WyzeConstants.HOMEKIT_COLOR_TEMP_MIN, WyzeConstants.HOMEKIT_COLOR_TEMP_MAX)
    this.getCharacteristic(Characteristic.ColorTemperature).updateValue(homeKitValue)
  }

  getService () {
    let service = this.homeKitAccessory.getService(Service.Lightbulb)

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Lightbulb)
    }

    return service
  }

  getCharacteristic (characteristic) {
    return this.getService().getCharacteristic(characteristic)
  }

  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async setOn (value, callback) {
    this.plugin.log.debug(`Setting power for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)

    try {
      await this.setProperty(WyzeConstants.WYZE_API_POWER_PROPERTY, (value) ? '1' : '0')
      callback()
    } catch (e) {
      callback(e)
    }
  }

  async setBrightness (value, callback) {
    await this.sleep(250)
    this.plugin.log.debug(`Setting brightness for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)

    try {
      await this.setProperty(WyzeConstants.WYZE_API_BRIGHTNESS_PROPERTY, value)
      callback()
    } catch (e) {
      callback(e)
    }
  }

  // TODO: Issues when Color Temp higher then
  async setColorTemperature (value, callback) {
    await this.sleep(500)
    const floatValue = this._rangeToFloat(value, WyzeConstants.HOMEKIT_COLOR_TEMP_MIN, WyzeConstants.HOMEKIT_COLOR_TEMP_MAX)
    const wyzeValue = this._floatToRange(floatValue, WyzeConstants.WYZE_COLOR_TEMP_MIN, WyzeConstants.WYZE_COLOR_TEMP_MAX)

    this.plugin.log.debug(`Setting color temperature for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value} (${wyzeValue})`)

    try {
      await this.setProperty(WyzeConstants.WYZE_API_COLOR_TEMP_PROPERTY, wyzeValue)
      callback()
    } catch (e) {
      callback(e)
    }
  }

  _rangeToFloat (value, min, max) {
    return (value - min) / (max - min)
  }

  _floatToRange (value, min, max) {
    return Math.round((value * (max - min)) + min)
  }
}
