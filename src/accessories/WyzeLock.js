const {
  Service,
  Characteristic
} = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
const WyzeConstants = require('../WyzeConstants')

const UNSECURED = Characteristic.LockCurrentState.UNSECURED
const SECURED = Characteristic.LockCurrentState.SECURED

const TARGET_SECURED = Characteristic.LockCurrentState.SECURED

// The state of Wyze Locks can be read just like normal properties
// However, setting the state of wyze locks needs to be done via a different API
// This api is async and therefore we need to poll the state of the lock after trying to set the state of the lock
// (I believe it's async due to the nature of the Zigbee-like protocol I've heard the Lock Gateway uses)
module.exports = class WyzeLock extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    this.lockService = this.homeKitAccessory.getService(Service.LockMechanism)

    if (!this.lockService) {
      this.lockService = this.homeKitAccessory.addService(Service.LockMechanism)
    }

    this.lockService.getCharacteristic(Characteristic.LockCurrentState)
      .onGet(this.getLockCurrentState.bind(this))

    this.lockService.getCharacteristic(Characteristic.LockTargetState)
      .onGet(this.getLockTargetState.bind(this))
      .onSet(this.setLockTargetState.bind(this))
  }

  async getLockCurrentState () {
    const propertyList = await this.getPropertyList()
    for (const property of propertyList.data.property_list) {
      switch (property.pid) {
        case WyzeConstants.WYZE_API_LOCKED_PROPERTY:
          return property.value === '0' ? SECURED : UNSECURED
      }
    }
  }

  async getLockTargetState () {
    const propertyList = await this.getPropertyList()
    for (const property of propertyList.data.property_list) {
      switch (property.pid) {
        case WyzeConstants.WYZE_API_LOCKED_PROPERTY:
          return property.value === '0' ? SECURED : UNSECURED
      }
    }
  }

  async setLockTargetState (targetState) {
    await this.plugin.client.controlLock(this.mac, this.product_model, (targetState === SECURED ? 'remoteLock' : 'remoteUnlock'))

    // Takes a few seconds for the lock command to actually update lock state property
    // Poll every second to see if the lock state has changed to what we expect, or time out after 20 attempts
    await this.poll(async () => await this.getLockCurrentState(), currentState => currentState === targetState, 1000, 20)

    this.lockService.setCharacteristic(Characteristic.LockCurrentState, targetState === TARGET_SECURED ? SECURED : UNSECURED)
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
