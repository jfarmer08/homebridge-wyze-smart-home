const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
const WyzeConstants = require('../WyzeConstants')

const HOMEBRIDGE_SERVICE = Service.LeakSensor
const HOMEBRIDGE_CHARACTERISTIC = Characteristic.LeakDetected
const HOMEBRIDGE_BATTERY_SERVICE = Service.Battery
const HOMEBRIDGE_BATTERY_CHARACTERISTIC = Characteristic.BatteryLevel
const HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC = Characteristic.StatusLowBattery

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeHumidity extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic()
    this.getBatteryCharacteristic()
    this.getIsBatteryLowCharacteristic()
  }

  getSensorService () {
    this.plugin.log.debug(`[LeakSensor] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE)

    if (!service) {
      this.plugin.log.debug(`[LeakSensor] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_SERVICE)
    }

    return service
  }

  getBatterySensorService () {
    this.plugin.log.debug(`[LeakSensorBattery] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      this.plugin.log.debug(`[LeakSensorBattery] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getIsBatteryLowSensorService () {
    this.plugin.log.debug(`[LeakSensorBatteryLow] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      this.plugin.log.debug(`[LeakSensorIsBatteryLow] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getOnCharacteristic () {
    this.plugin.log.debug(`[LeakSensor] Fetching status of "${this.display_name}"`)
    return this.getSensorService().getCharacteristic(HOMEBRIDGE_CHARACTERISTIC)
  }

  getBatteryCharacteristic () {
    this.plugin.log.debug(`[LeakSensorBattery] Fetching status of "${this.display_name}"`)
    return this.getBatterySensorService().getCharacteristic(HOMEBRIDGE_BATTERY_CHARACTERISTIC)
  }

  getIsBatteryLowCharacteristic () {
    this.plugin.log.debug(`[LeakSensorBattery] Fetching status of "${this.display_name}"`)
    return this.getIsBatteryLowSensorService().getCharacteristic(HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC)
  }

  async updateCharacteristics (device) {
    if (device.conn_state === WyzeConstants.WYZE_PROPERTY_DEVICE_ONLINE_VALUE_FALSE) {
      this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.plugin.log.debug(`[LeakSensor] Updating status of "${this.display_name}"`)
      this.getOnCharacteristic().updateValue(device.device_params.ws_detect_state)
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
