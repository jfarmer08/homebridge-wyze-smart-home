const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

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
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Humidity] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    let service = this.homeKitAccessory.getService(Service.HumiditySensor)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Humidity] Adding service for "${this.display_name} (${this.mac})"`)
      service = this.homeKitAccessory.addService(Service.HumiditySensor)
    }

    return service
  }

  getTemperatureSensorService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    let service = this.homeKitAccessory.getService(Service.TemperatureSensor)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature] Adding service for "${this.display_name} (${this.mac})"`)
      service = this.homeKitAccessory.addService(Service.TemperatureSensor)
    }

    return service
  }

  getBatterySensorService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] [Battery] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    let service = this.homeKitAccessory.getService(Service.Battery)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] [Battery] Adding service for "${this.display_name} (${this.mac})"`)
      service = this.homeKitAccessory.addService(Service.Battery)
    }

    return service
  }

  getIsBatteryLowSensorService () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] [Low Battery] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    let service = this.homeKitAccessory.getService(Service.Battery)

    if (!service) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] [Low Battery] Adding service for "${this.display_name} (${this.mac})"`)
      service = this.homeKitAccessory.addService(Service.Battery)
    }

    return service
  }

  getHumidityCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] Fetching status of "${this.display_name} (${this.mac})"`)
    return this.getHumiditySensorService().getCharacteristic(Characteristic.CurrentRelativeHumidity)
  }

  getTemperatureCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] Fetching status of "${this.display_name} (${this.mac})"`)
    return this.getTemperatureSensorService().getCharacteristic(Characteristic.CurrentTemperature)
  }

  getBatteryCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] [Battery] Fetching status of "${this.display_name} (${this.mac})"`)
    return this.getBatterySensorService().getCharacteristic(Characteristic.BatteryLevel)
  }

  getIsBatteryLowCharacteristic () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] [Low Battery] Fetching status of "${this.display_name} (${this.mac})"`)
    return this.getIsBatteryLowSensorService().getCharacteristic(Characteristic.StatusLowBattery)
  }

  updateCharacteristics (device) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log.info(`[Temperature Humidity] Updating status of "${this.display_name} (${this.mac})"`)
    if (device.conn_state === 0) {
      this.getHumidityCharacteristic().updateValue(noResponse)
    } else {
      this.getHumidityCharacteristic().updateValue(device.device_params.th_sensor_humidity)
      this.getTemperatureCharacteristic().updateValue((device.device_params.th_sensor_temperature - 32.0) / 1.8)
      this.getBatteryCharacteristic().updateValue(this.plugin.client.checkBatteryVoltage(device.device_params.voltage))
      this.getIsBatteryLowCharacteristic().updateValue(this.plugin.client.checkLowBattery(device.device_params.voltage))
    }
  }
}
