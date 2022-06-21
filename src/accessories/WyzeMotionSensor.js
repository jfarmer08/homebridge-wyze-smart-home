const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
const WyzeConstants = require('../WyzeConstants')

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
    this.plugin.log.debug(`[MotionSensor] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE)

    if (!service) {
      this.plugin.log.debug(`[MotionSensor] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_SERVICE)
    }

    return service
  }

  getBatterySensorService () {
    this.plugin.log.debug(`[MotionSensorBattery] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      this.plugin.log.debug(`[MotionSensorBattery] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getIsBatteryLowSensorService () {
    this.plugin.log.debug(`[MotionSensorIsBatteryLow] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      this.plugin.log.debug(`[MotionSensorIsBatteryLow] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getOnCharacteristic () {
    this.plugin.log.debug(`[MotionSensor] Fetching status of "${this.display_name}"`)
    return this.getSensorService().getCharacteristic(HOMEBRIDGE_CHARACTERISTIC)
  }

  getBatteryCharacteristic () {
    this.plugin.log.debug(`[MotionSensorBattery] Fetching status of "${this.display_name}"`)
    return this.getBatterySensorService().getCharacteristic(HOMEBRIDGE_BATTERY_CHARACTERISTIC)
  }

  getIsBatteryLowCharacteristic () {
    this.plugin.log.debug(`[MotionSensorBattery] Fetching status of "${this.display_name}"`)
    return this.getIsBatteryLowSensorService().getCharacteristic(HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC)
  }

  updateCharacteristics (device) {
    if (device.conn_state === WyzeConstants.WYZE_PROPERTY_DEVICE_ONLINE_VALUE_FALSE) {
      this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.plugin.log.debug(`[MotionSensor] Updating status of "${this.display_name}"`)
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
