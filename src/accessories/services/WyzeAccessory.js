const { Service, Characteristic } = require('../../types')

// Responses from the Wyze API can lag a little after a new value is set
const UPDATE_THROTTLE_MS = 1000

module.exports = class WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    this.updating = false
    this.lastTimestamp = null

    this.plugin = plugin
    this.homeKitAccessory = homeKitAccessory
  }

  get display_name () {
    return this.homeKitAccessory.displayName
  }

  get mac () {
    return this.homeKitAccessory.context.mac
  }

  get product_type () {
    return this.homeKitAccessory.context.product_type
  }

  get product_model () {
    return this.homeKitAccessory.context.product_model
  }

  /** Determines whether this accessory matches the given Wyze device */
  matches (device) {
    return this.mac === device.mac
  }

  async update (device, timestamp) {
    this.homeKitAccessory.context = {
      mac: device.mac,
      product_type: device.product_type,
      product_model: device.product_model,
      nickname: device.nickname
    }

    this.homeKitAccessory.getService(Service.AccessoryInformation)
      .updateCharacteristic(Characteristic.Name, device.nickname)
      .updateCharacteristic(Characteristic.Manufacturer, 'Wyze')
      .updateCharacteristic(Characteristic.Model, device.product_model)
      .updateCharacteristic(Characteristic.SerialNumber, device.mac)

    if (this.shouldUpdateCharacteristics(timestamp)) {
      await this.updateCharacteristics(device)
    }
  }

  shouldUpdateCharacteristics (timestamp) {
    if (this.updating) {
      return false
    }

    if (this.lastTimestamp && timestamp <= (this.lastTimestamp + UPDATE_THROTTLE_MS)) {
      return false
    }

    return true
  }

  updateCharacteristics (device) {
    //
  }

  async getPropertyList () {
    const response = await this.plugin.client.getPropertyList(this.mac, this.product_model)

    return response
  }

  async getLockInfo () {
    const response = await this.plugin.client.getLockInfo(this.mac, this.product_model)

    return response
  }

  async setIotPropSwitchPower (value) {
    const response = await this.plugin.client.setIotProp(this.mac, this.product_model, 'switch-power', value)
    return response
  }

  async setIotPropSwitchIot (value) {
    const response = await this.plugin.client.setIotProp(this.mac, 'switch-iot', value)

    return response
  }

  async wallSwitchGetIotProp() {
    var keys = "iot_state,switch-power,switch-iot,single_press_type"
    const response = await this.plugin.client.getIotProp(this.mac, keys)
    return response
  }

  async setProperty (property, value) {
    try {
      this.updating = true

      const response = await this.plugin.client.setProperty(this.mac, this.product_model, property, value)

      this.lastTimestamp = response.ts
    } finally {
      this.updating = false
    }
  }

  async runActionList (property, value) {
    try {
      this.updating = true
      const response = await this.plugin.client.runActionList(this.mac, this.product_model, property, value, 'set_mesh_property')

      this.lastTimestamp = response.ts
    } finally {
      this.updating = false
    }
  }

  async runActionListOnOff (property, value, actionKey) {
    try {
      this.updating = true
      this.plugin.log.debug(`Setting runActionList Power State ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
      const response = await this.plugin.client.runActionList(this.mac, this.product_model, property, value, actionKey)

      this.lastTimestamp = response.ts
    } finally {
      this.updating = false
    }
  }
}
