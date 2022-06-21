const colorsys = require('colorsys')
const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
const WyzeConstants = require('../WyzeConstants')

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeMeshLight extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getCharacteristic(Characteristic.On).on('set', this.setOn.bind(this))
    this.getCharacteristic(Characteristic.Brightness).on('set', this.setBrightness.bind(this))
    this.getCharacteristic(Characteristic.ColorTemperature).on('set', this.setColorTemperature.bind(this))
    this.getCharacteristic(Characteristic.Hue).on('set', this.setHue.bind(this))
    this.getCharacteristic(Characteristic.Saturation).on('set', this.setSaturation.bind(this))

    // Local caching of HSV color space handling separate Hue & Saturation on HomeKit
    // Caching idea for handling HSV colors from:
    //    https://github.com/QuickSander/homebridge-http-rgb-push/blob/master/index.js
    this.cache = {}
    this.cacheUpdated = false
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

          case WyzeConstants.WYZE_API_COLOR_PROPERTY:
            this.updateColor(property.value)
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

  updateColor (value) {
    // Convert a Hex color from Wyze into the HSL values recognized by HomeKit.
    const hslValue = colorsys.hex2Hsv(value);
    this.plugin.log.debug(`Updating color record for ${this.homeKitAccessory.context.mac} to ${value}: ${JSON.stringify(hslValue)}`)

    // Update Hue
    this.updateHue(hslValue.h)
    this.cache.hue = hslValue.h

    // Update Saturation
    this.updateSaturation(hslValue.s)
    this.cache.saturation = hslValue.s
  }

  updateHue (value) {
    this.getCharacteristic(Characteristic.Hue).updateValue(value)
  }

  updateSaturation (value) {
    this.getCharacteristic(Characteristic.Saturation).updateValue(value)
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
    this.plugin.log.debug(`Setting power for ${this.homeKitAccessory.context.mac} to ${value}`)

    try {
      await this.runActionList(WyzeConstants.WYZE_API_POWER_PROPERTY, (value) ? WyzeConstants.WYZE_PROPERTY_POWER_VALUE_ON : WyzeConstants.WYZE_PROPERTY_POWER_VALUE_OFF)
      callback()
    } catch (e) {
      callback(e)
    }
  }

  async setBrightness (value, callback) {
    await this.sleep(250)
    this.plugin.log.debug(`Setting brightness for ${this.homeKitAccessory.context.mac} to ${value}`)

    try {
      await this.runActionList(WyzeConstants.WYZE_API_BRIGHTNESS_PROPERTY, value)
      callback()
    } catch (e) {
      callback(e)
    }
  }

  async setColorTemperature (value, callback) {
    await this.sleep(500)
    const floatValue = this._rangeToFloat(value, WyzeConstants.HOMEKIT_COLOR_TEMP_MIN, WyzeConstants.HOMEKIT_COLOR_TEMP_MAX)
    const wyzeValue = this._floatToRange(floatValue, WyzeConstants.WYZE_COLOR_TEMP_MIN, WyzeConstants.WYZE_COLOR_TEMP_MAX)

    this.plugin.log.debug(`Setting color temperature for ${this.homeKitAccessory.context.mac} to ${value} (${wyzeValue})`)

    try {
      await this.runActionList(WyzeConstants.WYZE_API_COLOR_TEMP_PROPERTY, wyzeValue)
      callback()
    } catch (e) {
      callback(e)
    }
  }

  async setHue (value, callback) {
    await this.sleep(750)
    this.plugin.log.debug(`Setting hue (color) for ${this.homeKitAccessory.context.mac} to ${value}`)
    this.plugin.log.debug(`(H)S Values: ${value}, ${this.cache.saturation}`)

    try {
      this.cache.hue = value
      if (this.cacheUpdated) {
        let hexValue = colorsys.hsv2Hex(this.cache.hue, this.cache.saturation, 100)
        hexValue = hexValue.replace('#', '')
        this.plugin.log.debug(hexValue)

        await this.runActionList(WyzeConstants.WYZE_API_COLOR_PROPERTY, hexValue)
        this.cacheUpdated = false
      } else {
        this.cacheUpdated = true
      }
      callback()
    } catch (e) {
      callback(e)
    }
  }

  async setSaturation (value, callback) {
    await this.sleep(1000)
    this.plugin.log.debug(`Setting saturation (color) for ${this.homeKitAccessory.context.mac} to ${value}`)
    this.plugin.log.debug(`H(S) Values: ${this.cache.saturation}, ${value}`)

    try {
      this.cache.saturation = value
      if (this.cacheUpdated) {
        let hexValue = colorsys.hsv2Hex(this.cache.hue, this.cache.saturation, 100)
        hexValue = hexValue.replace('#', '')
        this.plugin.log.debug(hexValue)

        await this.runActionList(WyzeConstants.WYZE_API_COLOR_PROPERTY, hexValue)
        this.cacheUpdated = false
      } else {
        this.cacheUpdated = true
      }
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
