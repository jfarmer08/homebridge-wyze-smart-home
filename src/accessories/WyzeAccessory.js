const { Service, Characteristic } = require('../types')

// Responses from the Wyze API can lag a little after a new value is set
const UPDATE_THROTTLE_MS = 1000

module.exports = class WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    this.updating = false
    this.lastTimestamp = null

    this.plugin = plugin
    this.homeKitAccessory = homeKitAccessory
  }

  get display_name () { return this.homeKitAccessory.displayName }
  get mac () { return this.homeKitAccessory.context.mac }
  get product_type () { return this.homeKitAccessory.context.product_type }
  get product_model () { return this.homeKitAccessory.context.product_model }
  get single_press_type () { return this.homeKitAccessory.context.single_press_type }
  get double_press_type () { return this.homeKitAccessory.context.double_press_type }
  get triple_press_type () { return this.homeKitAccessory.context.triple_press_type }
  get long_press_type () { return this.homeKitAccessory.context.long_press_type }
  get iot_state () { return this.homeKitAccessory.context.iot_state } //Device online / offline
  get switch_power () { return this.homeKitAccessory.context.switch_power } //Power on / Power off

  /** Determines whether this accessory matches the given Wyze device */
  matches (device) {
    return this.mac === device.mac
  }

  async update (device, timestamp) {
    if(device.product_type == "Common"){
      this.homeKitAccessory.context = {
        mac: device.mac,
        product_type: device.product_type,
        product_model: device.product_model,
        nickname: device.nickname,
        switch_power: this.switch_power,
        iot_state: this.iot_state,
        double_press_type: this.double_press_type,
        single_press_type: this.single_press_type
      }
    } else {
      this.homeKitAccessory.context = {
        mac: device.mac,
        product_type: device.product_type,
        product_model: device.product_model,
        nickname: device.nickname
      }
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

  // Wall Switch Can we move this to its own class - wallSwitch
  async wallSwitchSetIotProp(deviceMac, productModel, prop, value) {
    let response
    try {
      this.updating = true
      response = await this.plugin.client.setIotProp(deviceMac, productModel, prop, value)

      this.lastTimestamp = response.ts
    } finally {
      this.updating = false
      return response

    }
  }

  async wallSwitchGetIotProp() {
    let keys = "iot_state,switch-power,switch-iot,single_press_type, double_press_type, triple_press_type, long_press_type"
    let response
    try {
      this.updating = true
      response = await this.plugin.client.getIotProp(this.mac, keys)
      let properties = response.data.props
      const prop_key = Object.keys(properties);
      for (const element of prop_key) {
        const prop = element;
        if (prop === 'iot_state') {
          this.homeKitAccessory.context.iot_state = properties[prop]
            } else if (prop == 'single_press_type') {
              this.homeKitAccessory.context.single_press_type = properties[prop]
            } else if (prop == 'double_press_type') {
              this.homeKitAccessory.context.double_press_type = properties[prop]
            } else if (prop == 'triple_press_type') {
              this.homeKitAccessory.context.triple_press_type = properties[prop]
            } 
            else if (prop == 'long_press_type') {
              this.homeKitAccessory.context.long_press_type = properties[prop]
            } else {
            if (prop == 'switch-power'){
              this.homeKitAccessory.context.switch_power = properties[prop]
            } 
        }
      }
      this.lastTimestamp = response.ts
    } finally {
      this.updating = false
      return response
     }
  }

  async power_onoff(value) {
    const response = await this.wallSwitchSetIotProp(this.mac, this.product_model, 'switch-power', value)
    return response
  }

  async iot_onoff(value) {
    const response = await this.wallSwitchSetIotProp(this.mac, this.product_model, 'switch-iot', value)
    return response
  }
    //Thermostat: Can we move this to its own class - thermostat
  async thermostatSetIotProp(deviceMac, prop, value) {
    const response = await this.plugin.client.setIotProp(deviceMac, prop, value)
    return response
  }
  async thermostatGetIotProp() {
    // Might need to copy wallSwitchGetIotProp = and store context
    const keys = 'trigger_off_val,emheat,temperature,humidity,time2temp_val,protect_time,mode_sys,heat_sp,cool_sp, current_scenario,config_scenario,temp_unit,fan_mode,iot_state,w_city_id,w_lat,w_lon,working_state, dev_hold,dev_holdtime,asw_hold,app_version,setup_state,wiring_logic_id,save_comfort_balance, kid_lock,calibrate_humidity,calibrate_temperature,fancirc_time,query_schedule'
    const response = await this.plugin.client.getIotProp(this.mac, keys)
    return response
  }

  async setPreset() {
    const response = await this.thermostatSetIotProp(this.mac, 'config_scenario', value)
    return response
}
// auto, on, off / / ['auto', 'circ', 'on']
  async setFanMode() {
    const response = await this.thermostatSetIotProp(this.mac, 'fan_mode', value)
    return response
}
// auto, heat, cool
  async setHvacMode() {
    const response =await this.thermostatSetIotProp(this.mac, 'mode_sys', value)
    return response
  }

  // heat stop point
  async setHeatPoint() {
    const response = await this.thermostatSetIotProp(this.mac, 'heat_sp', value)
    return response
  }

  // Cool stop point
  async setCoolPoint() {
    const response = await this.thermostatSetIotProp(this.mac, 'cool_sp', value)
    return response
  }
  //HMS
  async getHmsID() {
    //need to phrase out HMSID from devices-deviceList and return that
    const response = await this.plugin.client.getPlanBindingListByUser()
    return response
  }

  async setHMSCode(hms_id, mode) {
     if(mode == "mode(Disarmed)") {
      await this.plugin.client.disableRemeAlarm(hms_id)
      await this.plugin.client.monitoringProfileActive(hms_id, 0, 0)
     } else if( mode === HMSMode.AWAY ) {
      await this.plugin.client.monitoringProfileActive(hms_id, 0, 1)
     }  else if( mode === HMSMode.HOME ) {
      await this.plugin.client.monitoringProfileActive(hms_id, 1, 0)
     }
     return response
  }

  async getHmsUpdate(hms_id) {
    const response = await this.plugin.client.getPlanBindingListByUser(hms_id)
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
