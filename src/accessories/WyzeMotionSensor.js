const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const HOMEBRIDGE_SERVICE = Service.MotionSensor
const HOMEBRIDGE_CHARACTERISTIC = Characteristic.MotionDetected
const HOMEBRIDGE_BATTERY_SERVICE = Service.Battery
const HOMEBRIDGE_BATTERY_CHARACTERISTIC = Characteristic.BatteryLevel
const HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC = Characteristic.StatusLowBattery

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeMotionSensor extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic()
    this.getBatteryCharacteristic()
    this.getIsBatteryLowCharacteristic()
  }

  getSensorService () {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensor] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE)

    if (!service) {
      if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensor] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_SERVICE)
    }

    return service
  }

  getBatterySensorService () {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensorBattery] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensorBattery] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getIsBatteryLowSensorService () {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensorIsBatteryLow] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensorIsBatteryLow] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getOnCharacteristic () {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensor] Fetching status of "${this.display_name}"`)
    return this.getSensorService().getCharacteristic(HOMEBRIDGE_CHARACTERISTIC)
  }

  getBatteryCharacteristic () {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensorBattery] Fetching status of "${this.display_name}"`)
    return this.getBatterySensorService().getCharacteristic(HOMEBRIDGE_BATTERY_CHARACTERISTIC)
  }

  getIsBatteryLowCharacteristic () {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensorBattery] Fetching status of "${this.display_name}"`)
    return this.getIsBatteryLowSensorService().getCharacteristic(HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC)
  }

  updateCharacteristics (device) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`[MotionSensor] Updating status of "${this.display_name}"`)
    if (device.conn_state === 0) {
      this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.getOnCharacteristic().updateValue(device.device_params.motion_state)
      this.getBatteryCharacteristic().updateValue(this.getBatteryVoltage(device.device_params.voltage))
      this.getIsBatteryLowCharacteristic().updateValue(device.device_params.is_low_battery)
    }
  }

  getBatteryVoltage (deviceVoltage) {
    if (deviceVoltage >= 100) {
      return 100
    } else { return deviceVoltage }
  }
}
