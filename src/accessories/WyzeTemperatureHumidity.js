const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const HOMEBRIDGE_HUMIDITY_SERVICE = Service.HumiditySensor
const HOMEBRIDGE_HUMIDITY_CHARACTERISTIC = Characteristic.CurrentRelativeHumidity
const HOMEBRIDGE_TEMPERATURE_SERVICE = Service.TemperatureSensor
const HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC = Characteristic.CurrentTemperature
const HOMEBRIDGE_BATTERY_SERVICE = Service.Battery
const HOMEBRIDGE_BATTERY_CHARACTERISTIC = Characteristic.BatteryLevel
const HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC = Characteristic.StatusLowBattery

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeTemperatureHumidity extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getTemperatureCharacteristic()
    this.getHumidityCharacteristic()
    this.getBatteryCharacteristic()
    this.getIsBatteryLowCharacteristic()
  }

  getHumiditySensorService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidity] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_HUMIDITY_SERVICE)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidity] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_HUMIDITY_SERVICE)
    }

    return service
  }

  getTemperatureSensorService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidity] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_TEMPERATURE_SERVICE)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidity] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_TEMPERATURE_SERVICE)
    }

    return service
  }

  getBatterySensorService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidityBattery] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidityBattery] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getIsBatteryLowSensorService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidityIsBatteryLow] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidityIsBatteryLow] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getHumidityCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidity] Fetching status of "${this.display_name}"`)
    return this.getHumiditySensorService().getCharacteristic(HOMEBRIDGE_HUMIDITY_CHARACTERISTIC)
  }

  getTemperatureCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidity] Fetching status of "${this.display_name}"`)
    return this.getTemperatureSensorService().getCharacteristic(HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC)
  }

  getBatteryCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidityBattery] Fetching status of "${this.display_name}"`)
    return this.getBatterySensorService().getCharacteristic(HOMEBRIDGE_BATTERY_CHARACTERISTIC)
  }

  getIsBatteryLowCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidityBattery] Fetching status of "${this.display_name}"`)
    return this.getIsBatteryLowSensorService().getCharacteristic(HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC)
  }

  updateCharacteristics (device) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[TemperatureHumidity] Updating status of "${this.display_name}"`)
    if (device.conn_state === 0) {
      this.getHumidityCharacteristic().updateValue(noResponse)
    } else {
      this.getHumidityCharacteristic().updateValue(this.homeKitAccessory.context.device_params.th_sensor_humidity)
      this.getTemperatureCharacteristic().updateValue((this.homeKitAccessory.context.device_params.th_sensor_temperature - 32.0) / 1.8)
      this.getBatteryCharacteristic().updateValue(this.plugin.client.checkBatteryVoltage(this.homeKitAccessory.context.device_params.voltage))
      this.getIsBatteryLowCharacteristic().updateValue(this.homeKitAccessory.context.device_params.is_low_battery)
    }
  }
}
