const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeMotionSensor extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic()
    this.getBatteryCharacteristic()
    this.getIsBatteryLowCharacteristic()
  }

  getSensorService() {
    if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensor] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    let service = this.homeKitAccessory.getService(Service.MotionSensor)

    if (!service) {
      if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensor] Adding service for "${this.display_name} (${this.mac})"`)
      service = this.homeKitAccessory.addService(Service.MotionSensor)
    }

    return service
  }

  getBatterySensorService() {
    if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensorBattery] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    let service = this.homeKitAccessory.getService(Service.Battery)

    if (!service) {
      if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensorBattery] Adding service for "${this.display_name} (${this.mac})"`)
      service = this.homeKitAccessory.addService(Service.Battery)
    }

    return service
  }

  getIsBatteryLowSensorService() {
    if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensorIsBatteryLow] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    let service = this.homeKitAccessory.getService(Service.Battery)

    if (!service) {
      if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensorIsBatteryLow] Adding service for "${this.display_name} (${this.mac})"`)
      service = this.homeKitAccessory.addService(Service.Battery)
    }

    return service
  }

  getOnCharacteristic() {
    if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensor] Fetching status of "${this.display_name} (${this.mac})"`)
    return this.getSensorService().getCharacteristic(Characteristic.MotionDetected)
  }

  getBatteryCharacteristic() {
    if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensorBattery] Fetching status of "${this.display_name} (${this.mac})"`)
    return this.getBatterySensorService().getCharacteristic(Characteristic.BatteryLevel)
  }

  getIsBatteryLowCharacteristic() {
    if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensorBattery] Fetching status of "${this.display_name} (${this.mac})"`)
    return this.getIsBatteryLowSensorService().getCharacteristic(Characteristic.StatusLowBattery)
  }

  updateCharacteristics(device) {
    if (this.plugin.config.logLevel == "debug") this.plugin.log.info(`[MotionSensor] Updating status of "${this.display_name} (${this.mac})"`)
    if (device.conn_state === 0) {
      this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.getOnCharacteristic().updateValue(device.device_params.motion_state)
      this.getBatteryCharacteristic().updateValue(this.plugin.client.checkBatteryVoltage(device.device_params.voltage))
      this.getIsBatteryLowCharacteristic().updateValue(this.plugin.client.checkLowBattery(device.device_params.voltage))
    }
  }
}
