const {
  Service,
  Characteristic,
} = require('../types')
const WyzeAccessory = require('./services/WyzeAccessory')

const WYZE_API_LOCKED_PROPERTY = 'P3'
const WYZE_API_ONLINE_PROPERTY = 'P5'
const WYZE_API_BATTERY_PROPERTY = 'P8'
const WYZE_API_DOOR_OPEN_CLOSED_STATE = 'P2001'

const HOMEBRIDGE_LOCK_MECHANISM_SERVICE = Service.LockMechanism
const HOMEBRIDGE_LOCK_MECHANISM_CURRENT_STATE_CHARACTERISTIC = Characteristic.LockCurrentState
const HOMEBRIDGE_LOCK_MECHANISM_TARGET_STATE_CHARACTERISTIC = Characteristic.LockTargetState

const HOMEBRIDGE_BATTERY_SERVICE = Service.Battery
const HOMEBRIDGE_BATTERY_CHARACTERISTIC = Characteristic.BatteryLevel

const HOMEBRIDGE_CONTACT_SENSOR_SERVICE = Service.ContactSensor
const HOMEBRIDGE_CONTACT_SENSOR_CHARACTERISTIC = Characteristic.ContactSensorState.CurrentDoorState

//const noResponse = new Error('No Response')
//noResponse.toString = () => { return noResponse.message }

// The state of Wyze Locks can be read just like normal properties
// However, setting the state of wyze locks needs to be done via a different API
// This api is async and therefore we need to poll the state of the lock after trying to set the state of the lock
// (I believe it's async due to the nature of the Zigbee-like protocol I've heard the Lock Gateway uses)
module.exports = class WyzeLock extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.lockService = this.homeKitAccessory.getService(HOMEBRIDGE_LOCK_MECHANISM_SERVICE)
    this.contactService = this.homeKitAccessory.getService(HOMEBRIDGE_CONTACT_SENSOR_SERVICE)
    this.batteryService = this.homeKitAccessory.getService(HOMEBRIDGE_BATTERY_SERVICE)

    if (!this.lockService) {
      this.lockService = this.homeKitAccessory.addService(HOMEBRIDGE_LOCK_MECHANISM_SERVICE)
    }

    if (!this.contactService) {
      this.contactService = this.homeKitAccessory.addService(HOMEBRIDGE_CONTACT_SENSOR_SERVICE)
    }

    if (!this.batteryService) {
      this.batteryService = this.homeKitAccessory.addService(HOMEBRIDGE_BATTERY_SERVICE)
    }

    this.batteryService.getCharacteristic(HOMEBRIDGE_BATTERY_CHARACTERISTIC)
      .onGet(this.getBatteryStatus.bind(this))

    this.contactService.getCharacteristic(HOMEBRIDGE_CONTACT_SENSOR_CHARACTERISTIC)
      .onGet(this.getDoorStatus.bind(this))

    this.lockService.getCharacteristic(HOMEBRIDGE_LOCK_MECHANISM_CURRENT_STATE_CHARACTERISTIC)
      .onGet(this.getLockCurrentState.bind(this))

    this.lockService.getCharacteristic(HOMEBRIDGE_LOCK_MECHANISM_TARGET_STATE_CHARACTERISTIC)
      .onGet(this.getLockTargetState.bind(this))
      .onSet(this.setLockTargetState.bind(this))
  }

  async updateCharacteristics (device) {
      this.plugin.log.debug(`[Lock] Updating status of "${this.display_name}"`)
      this.getDoorStatus()
  }

  async getLockCurrentState () {
    const propertyList = await this.getLockInfo(this.mac, this.product_model)
    console.log(propertyList.device.door_open_status)
    this.plugin.log.debug(`[Lock] getLockCurrentState "${propertyList.device.locker_status.hardlock}"`)
    if (propertyList.device.locker_status.hardlock === 2) {
      return HOMEBRIDGE_LOCK_MECHANISM_CURRENT_STATE_CHARACTERISTIC.UNSECURED
    } else {
      return HOMEBRIDGE_LOCK_MECHANISM_CURRENT_STATE_CHARACTERISTIC.SECURED
    }  
  }

  async getLockTargetState () {
    const propertyList = await this.getLockInfo(this.mac, this.product_model)
    console.log(propertyList.device.door_open_status)
    this.plugin.log.debug(`[Lock] getLockTargetState "${propertyList.device.locker_status.hardlock}"`)
    if (propertyList.device.locker_status.hardlock === 2) {
      return HOMEBRIDGE_LOCK_MECHANISM_TARGET_STATE_CHARACTERISTIC.UNSECURED
    } else {
      return HOMEBRIDGE_LOCK_MECHANISM_TARGET_STATE_CHARACTERISTIC.SECURED
    }
  }

  async getDoorStatus () {
    const propertyList = await this.getPropertyList()
    for (const property of propertyList.data.property_list) {
      switch (property.pid) {
        case WYZE_API_DOOR_OPEN_CLOSED_STATE:
          this.plugin.log.debug(`[Lock] LockDoorStatus "${property.value}"`)
          return property.value === '1' ? HOMEBRIDGE_CONTACT_SENSOR_CHARACTERISTIC.CLOSED : HOMEBRIDGE_CONTACT_SENSOR_CHARACTERISTIC.OPEN
      }
    }
  }

  async getBatteryStatus () {
    const propertyList = await this.getLockInfo(this.mac, this.product_model)
        this.plugin.log.debug(`[Lock] LockBattery "${propertyList.device.power}"`)
        return propertyList.device.power
  }

  async setLockTargetState (targetState) {
    this.plugin.log.debug(`[Lock] setLockTargetSate "${targetState}"`)
    await this.plugin.client.controlLock(this.mac, this.product_model, (targetState === HOMEBRIDGE_LOCK_MECHANISM_CURRENT_STATE_CHARACTERISTIC.SECURED ? 'remoteLock' : 'remoteUnlock'))

    // Takes a few seconds for the lock command to actually update lock state property
    // Poll every second to see if the lock state has changed to what we expect, or time out after 30 attempts
    await this.poll(async () => await this.getLockCurrentState(), currentState => currentState === targetState, 1000, 30)
    this.lockService.setCharacteristic(Characteristic.LockCurrentState, targetState === HOMEBRIDGE_LOCK_MECHANISM_TARGET_STATE_CHARACTERISTIC.SECURED ? HOMEBRIDGE_LOCK_MECHANISM_CURRENT_STATE_CHARACTERISTIC.SECURED : HOMEBRIDGE_LOCK_MECHANISM_CURRENT_STATE_CHARACTERISTIC.UNSECURED)
  }

  async poll (fn, validate, interval, maxAttempts) {
    let attempts = 0

    const executePoll = async (resolve, reject) => {
      const result = await fn()
      attempts++

      if (validate(result)) {
        return resolve(result)
      } else if (maxAttempts && maxAttempts === attempts) {
        return reject(new Error('Exceeded maximum attempts'))
      } else {
        setTimeout(executePoll, interval, resolve, reject)
      }
    }

    return new Promise(executePoll)
  }
}
