const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const HOMEBRIDGE_SERVICE = Service.ContactSensor
const HOMEBRIDGE_CHARACTERISTIC = Characteristic.ContactSensorState
const HOMEBRIDGE_BATTERY_SERVICE = Service.Battery
const HOMEBRIDGE_BATTERY_CHARACTERISTIC = Characteristic.BatteryLevel
const HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC = Characteristic.StatusLowBattery

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeContactSensor extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.getOnCharacteristic()
    this.getBatteryCharacteristic()
    this.getIsBatteryLowCharacteristic()
  }

  getSensorService () {
    this.plugin.log.debug(`[ContactSensor] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_SERVICE)

    if (!service) {
      this.plugin.log.debug(`[ContactSensor] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_SERVICE)
    }

    return service
  }

  getBatterySensorService () {
    this.plugin.log.debug(`[ContactSensorBattery] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)
    if (!service) {
      this.plugin.log.debug(`[ContactSensorBattery] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getIsBatteryLowSensorService () {
    this.plugin.log.debug(`[ContactSensorIsBatteryLow] Retrieving previous service for "${this.display_name}"`)
    let service = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!service) {
      this.plugin.log.debug(`[ContactSensorIsBatteryLow] Adding service for "${this.display_name}"`)
      service = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    return service
  }

  getOnCharacteristic () {
    this.plugin.log.debug(`[ContactSensor] Fetching status of "${this.display_name}"`)
    return this.getSensorService().getCharacteristic(HOMEBRIDGE_CHARACTERISTIC)
  }

  getBatteryCharacteristic () {
    this.plugin.log.debug(`[ContactSensorBattery] Fetching status of "${this.display_name}"`)
    return this.getBatterySensorService().getCharacteristic(HOMEBRIDGE_BATTERY_CHARACTERISTIC)
  }

  getIsBatteryLowCharacteristic () {
    this.plugin.log.debug(`[ContactSensorBattery] Fetching status of "${this.display_name}"`)
    return this.getIsBatteryLowSensorService().getCharacteristic(HOMEBRIDGE_IS_BATTERY_LOW_CHARACTERISTIC)
  }

  updateCharacteristics (device) {
    this.plugin.log.debug(`[ContactSensor] Updating status of "${this.display_name}"`)

    if (device.conn_state === 0) {
      this.getOnCharacteristic().updateValue(noResponse)
    } else {
      this.getOnCharacteristic().updateValue(device.device_params.open_close_state)
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
