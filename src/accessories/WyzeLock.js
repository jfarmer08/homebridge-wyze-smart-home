const {Service,Characteristic,} = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeLock extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.lockService = this.homeKitAccessory.getService(Service.LockMechanism)
    this.contactService = this.homeKitAccessory.getService(Service.ContactSensor)
    this.batteryService = this.homeKitAccessory.getService(Service.Battery)

    if (!this.lockService) {
      this.lockService = this.homeKitAccessory.addService(Service.LockMechanism)
    }

    if (!this.contactService) {
      this.contactService = this.homeKitAccessory.addService(Service.ContactSensor)
    }

    if (!this.batteryService) {
      this.batteryService = this.homeKitAccessory.addService(Service.Battery)
    }

    this.batteryService.getCharacteristic(Characteristic.BatteryLevel)
      .onGet(this.getBatteryStatus.bind(this))

    this.contactService.getCharacteristic(Characteristic.ContactSensorState)
      .onGet(this.getDoorStatus.bind(this))

    this.lockService.getCharacteristic(Characteristic.LockCurrentState)
      .onGet(this.getLockCurrentState.bind(this))

    this.lockService.getCharacteristic(Characteristic.LockTargetState)
      .onGet(this.getLockTargetState.bind(this))
      .onSet(this.setLockTargetState.bind(this))
      
  }

  async updateCharacteristics (device) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Lock] Update Lock Characteristics "${this.display_name}"`)
    if (device.conn_state === 0) {
      this.getLockCurrentState().updateValue(noResponse)
    } else {
      this.getLockProperty()
      this.getLockCurrentState()
      this.getDoorStatus()
      this.getBatteryStatus()
    }
  }

  async getLockCurrentState () {

    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Lock] Getting Lock Current State "${this.display_name}"`)
    console.log('getLockCurrentState'+ this.homeKitAccessory.context.device_params.hardlock)
    if (this.homeKitAccessory.context.device_params.hardlock === 2) {
      return Characteristic.LockTargetState.UNSECURED
    } else {
      return Characteristic.LockTargetState.SECURED
    }
  }

  async getLockTargetState () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Lock] Getting Lock Target State "${this.display_name}"`)

    if (this.homeKitAccessory.context.device_params.hardlock === 2) {
      return Characteristic.LockTargetState.UNSECURED
    } else {
      return Characteristic.LockTargetState.SECURED
    }
  }

  async getDoorStatus () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Lock] Getting Door Status "${this.display_name}"`)
    if (this.homeKitAccessory.context.device_params.door_open_status === 1) {
      return Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
    } else {
      return Characteristic.ContactSensorState.CONTACT_DETECTED
    }
  }

  async getBatteryStatus () {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Lock] Getting Lock Battery "${this.display_name}"`)
    return this.plugin.client.checkBatteryVoltage(this.homeKitAccessory.context.device_params.power)
  }

  async setLockTargetState (targetState) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Lock] Setting Lock Target State "${targetState}"`) // this is zero or 1 
    await this.plugin.client.controlLock(this.mac, this.product_model, (targetState === Characteristic.LockCurrentState.SECURED ? 'remoteLock' : 'remoteUnlock'))

    // Takes a few seconds for the lock command to actually update lock state property
    // Poll every second to see if the lock state has changed to what we expect, or time out after 30 attempts
    //await this.poll(async () => await this.getLockCurrentState(), currentState => currentState === targetState, 1000, 10)
    this.lockService.setCharacteristic(Characteristic.LockCurrentState, targetState === Characteristic.LockTargetState.SECURED ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED)
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
