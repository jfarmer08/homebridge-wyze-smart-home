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
  // Default Prop
  get display_name ()             { return this.homeKitAccessory.displayName }
  get mac ()                      { return this.homeKitAccessory.context.mac }
  get product_type ()             { return this.homeKitAccessory.context.product_type }
  get product_model ()            { return this.homeKitAccessory.context.product_model }
  // Wall Switch Prop
  get single_press_type ()        { return this.homeKitAccessory.context.device_params?.single_press_type }
  get double_press_type ()        { return this.homeKitAccessory.context.device_params?.double_press_type }
  get triple_press_type ()        { return this.homeKitAccessory.context.device_params?.triple_press_type }
  get long_press_type ()          { return this.homeKitAccessory.context.device_params?.long_press_type }
  get iot_state ()                { return this.homeKitAccessory.context.device_params?.iot_state } //Device online / offline
  get switch_power ()             { return this.homeKitAccessory.context.device_params?.switch_power } //Power on / Power off
  // Lock Prop - only add get if you need to access them
  // From Device List
  get switch_state ()             { return this.homeKitAccessory.context.device_params.switch_state }
  get open_close_state ()         { return this.homeKitAccessory.context.device_params.open_close_state }
  // from lockInfo
  get lockPower ()                { return this.homeKitAccessory.context.device_params?.power }
  get lockDoorOpenStatus ()       { return this.homeKitAccessory.context.device_params?.door_open_status }
  get lockOnoffLine ()            { return this.homeKitAccessory.context.device_params?.onoff_line }
  get lockTrashMode ()            { return this.homeKitAccessory.context.device_params?.trash_mode }
  get lockKeypadEnableStatus ()   { return this.homeKitAccessory.context.device_params?.keypad_enable_status }
  get lockDoorSensor ()           { return this.homeKitAccessory.context.device_params?.door_sensor }
  get lockKeypadPower ()          { return this.homeKitAccessory.context.device_params?.keypadPower }
  get lockKeypadOnoffLine ()      { return this.homeKitAccessory.context.device_params?.keypadOnoff_line }
  get lockKeypadMac ()            { return this.homeKitAccessory.context.device_params?.keypadMac }
  get lockLockerStatusDoor ()     { return this.homeKitAccessory.context.device_params?.door }
  get lockLockerStatusHardlock () { return this.homeKitAccessory.context.device_params?.hardlock }
  // from Camera
  get cameraPowerSwitch ()        { return this.homeKitAccessory.context.device_params.power_switch}
  get cameraMotionSwitch ()       { return this.homeKitAccessory.context.device_params.motion_alarm_switch}

  // from thermostat
  get thermostatTemperature()     { return this.homeKitAccessory.context.device_params?.temperature }
  set thermostatTemperature(value){ this.homeKitAccessory.context.device_params.temperature = value }

  get thermostatModeSys()         { return this.homeKitAccessory.context.device_params?.mode_sys }
  set thermostatModeSys(value)    { this.homeKitAccessory.context.device_params.mode_sys = value }

  get thermostatWorkingState()    { return this.homeKitAccessory.context.device_params?.working_state }
  set thermostatWorkingState(value)    { this.homeKitAccessory.context.device_params.working_state = value }

  get thermostatCoolSetpoint()    { return this.homeKitAccessory.context.device_params?.cool_sp }
  set thermostatCoolSetpoint(value)    { this.homeKitAccessory.context.device_params.cool_sp = value}

  get thermostatHeatSetpoint()    { return this.homeKitAccessory.context.device_params?.heat_sp }
  set thermostatHeatSetpoint(value)    { this.homeKitAccessory.context.device_params.heat_sp = value }

  get thermostatTempUnit()        { return this.homeKitAccessory.context.device_params?.temp_unit }
  set thermostatTempUnit(value)        { this.homeKitAccessory.context.device_params.temp_unit = value }

  get thermostatConnState()       { return this.homeKitAccessory.context.conn_state }


  /** Determines whether this accessory matches the given Wyze device */
  matches (device) {
    return this.mac === device.mac
  }

  async update (device, timestamp) {
    const productType = device.product_type
    const productModel = device.product_model

    switch (productType) {
      case "OutdoorPlug":
        if(productModel == "WLPPO-SUB") {
          this.homeKitAccessory.context = {
            mac: device.mac,
            product_type: device.product_type,
            product_model: device.product_model,
            nickname: device.nickname,
            conn_state: device.conn_state,
            push_switch: device.push_switch,
            device_params: device.device_params = {
              switch_state: device.device_params.switch_state,
              photosensitive_switch: device.device_params.photosensitive_switch,
              ssid : device.device_params.ssid,
              ip : device.device_params.ip,
              rssi : device.device_params.rssi,
            }, 
          }
          break
        }
      case "Plug":
        if(productModel == "WLPP1") {
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            switch_state: device.device_params.switch_state,
            ssid : device.device_params.ssid,
            ip : device.device_params.ip,
            rssi : device.device_params.rssi,
            },
        }
        break
      }
      case "Common":
        if(productModel == "LD_SS1") {
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            switch_state: device.device_params.switch_state,
            connection_state: device.device_params.connection_state,
            switch_power: this.switch_power,
            iot_state: this.iot_state,
            double_press_type: this.double_press_type,
            single_press_type: this.single_press_type,
          },
        }
        break
      }
      case "Camera":
        if(productModel == "WYZEC1-JZ" || productModel == "WYZEDB3" || productModel == "WYZE_CAKP2JFUS") {
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          device_params: device.device_params = {
            p2p_id : device.device_params.p2p_id,
            p2p_type : device.device_params.p2p_type,
            ssid : device.device_params.ssid,
            ip : device.device_params.ip,
            public_ip : device.device_params.public_ip,
            power_switch : device.device_params.power_switch,
            temperature : device.device_params.temperature,
            humidity : device.device_params.humidity,
            temp_humi_room_type : device.device_params.temp_humi_room_type,
            comfort_standard_level : device.device_params.comfort_standard_level,
            is_temperature_humidity : device.device_params.is_temperature_humidity,
            records_event_switch : device.device_params.records_event_switch,
            motion_alarm_switch : device.device_params.motion_alarm_switch,
            audio_alarm_switch : device.device_params.audio_alarm_switch,
            smoke_alarm_switch : device.device_params.smoke_alarm_switch,
            co_alarm_switch : device.device_params.co_alarm_switch,
            electricity : device.device_params.electricity,
            battery_charging_status : device.device_params.battery_charging_status,
            is_link_toy_car : device.device_params.is_link_toy_car,
            power_saving_mode_switch : device.device_params.power_saving_mode_switch,
            dongle_product_model: device.device_params.dongle_product_model,
            ai_notification_v2: device.device_params.ai_notification_v2,
          },
        }
        break
      }
      case "LightStrip":
      case "Light":
      case "MeshLight":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            switch_state : device.device_params.switch_state,
            ssid : device.device_params.ssid,
            ip : device.device_params.ip,
            rssi : device.device_params.rssi,
          }
        }
        break
      case "OutdoorPlug":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            switch_state : device.device_params.switch_state,
            photosensitive_switch: device.device_params.photosensitive_switch,
            ssid : device.device_params.ssid,
            ip : device.device_params.ip,
            rssi : device.device_params.rssi,
          },
        }
        break
      case "TemperatureHumidity":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            th_sensor_temperature : device.device_params.th_sensor_temperature,
            th_sensor_humidity: device.device_params.th_sensor_humidity,
            voltage : device.device_params.voltage,
            is_low_battery : device.device_params.is_low_battery,
            rssi : device.device_params.rssi,
          }
        }
        break
      case "MotionSensor":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            motion_state : device.device_params.motion_state,
            motion_state_ts: device.device_params.motion_state_ts,
            voltage : device.device_params.voltage,
            is_low_battery : device.device_params.is_low_battery,
            rssi : device.device_params.rssi,
          }
        }
        break
      case "LeakSensor":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            ws_detect_state : device.device_params.ws_detect_state,
            ws_detect_state_ts: device.device_params.ws_detect_state_ts,
            voltage : device.device_params.voltage,
            is_low_battery : device.device_params.is_low_battery,
            rssi : device.device_params.rssi,
          }
        }
        break
      case "ContactSensor":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            open_close_state : device.device_params.open_close_state,
            open_close_state_ts: device.device_params.open_close_state_ts,
            voltage : device.device_params.voltage,
            is_low_battery : device.device_params.is_low_battery,
            rssi : device.device_params.rssi,
          }
        }
        break
      case "Lock":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: device.device_params = {
            switch_state : device.device_params.switch_state,
            open_close_state: device.device_params.open_close_state,
            onoff_line: this.lockOnoffLine,
            power: this.lockPower,
            door_open_status: this.lockDoorOpenStatus,
            trash_mode: this.lockTrashMode,
            keypad_enable_status: this.lockKeypadEnableStatus,
            door_sensor: this.lockDoorSensor,
            keypadPower: this.lockKeypadPower,
            keypadOnoff_line: this.lockKeypadOnoffLine,
            keypadMac: this.lockKeypadMac,
            door: this.lockLockerStatusDoor,
            hardlock: this.lockLockerStatusHardlock,
          }        
        }
        break
        case "Thermostat":
          this.homeKitAccessory.context = {
            mac: device.mac,
            product_type: device.product_type,
            product_model: device.product_model,
            nickname: device.nickname,
            conn_state: device.conn_state,
            push_switch: device.push_switch,
            device_params: device.device_params = {
              temperature: this.thermostatTemperature,
              cool_sp: this.thermostatCoolSetpoint,
              heat_sp: this.thermostatHeatSetpoint,
              working_state: this.thermostatWorkingState,
              temp_unit: this.thermostatTempUnit,
              mode_sys: this.thermostatWorkingState
            }        
          }
          break
      default:
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
        }
        break
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

  async lockGetProperty() {
    this.updating = true
    const propertyList = await this.plugin.client.getLockInfo(this.mac, this.product_model)
    var lockProperties = propertyList.device
    const prop_key = Object.keys(lockProperties)
    for (const element of prop_key) {
      const prop = element;
      switch (prop) {
        case "onoff_line":
          this.homeKitAccessory.context.device_params.onoff_line = lockProperties[prop]
          
        case "power":
          this.homeKitAccessory.context.device_params.power = lockProperties[prop]
          
        case "door_open_status":
          this.homeKitAccessory.context.device_params.door_open_status = lockProperties[prop]
          
        case "trash_mode":
          this.homeKitAccessory.context.device_params.trash_mode = lockProperties[prop]
          
        case "keypad_enable_status":
          this.homeKitAccessory.context.device_params.keypad_enable_status = lockProperties[prop]
          
        case "door_sensor":
          this.homeKitAccessory.context.device_params.door_sensor = lockProperties[prop]
          
      }
    }
    var lockerStatusProperties = propertyList.device.locker_status
    const prop_keyLock = Object.keys(lockerStatusProperties)
    for (const element of prop_keyLock) {
      const prop = element;
      switch (prop){
        case "door":
          this.homeKitAccessory.context.device_params.door = lockerStatusProperties[prop]
          
        case "hardlock":
          this.homeKitAccessory.context.device_params.hardlock = lockerStatusProperties[prop]
          
      }
    } 
    var lockKeypadProperties = propertyList.device.keypad
    const prop_keypad = Object.keys(lockKeypadProperties)
    for (const element of prop_keypad) {
      const prop = element
      switch (prop ) {
        case "power":
          this.homeKitAccessory.context.device_params.keypadPower = lockKeypadProperties[prop]
          
        case "onoff_line":
          this.homeKitAccessory.context.device_params.keypadOnoff_line = lockKeypadProperties[prop]
      }
    } 
    var lockKeypadProp = propertyList.device.keypad.hardware_info
    const prop_keypadProp = Object.keys(lockKeypadProp)
    for (const element of prop_keypadProp) {
      const prop = element
      switch (prop ) {

        case "mac":
          this.homeKitAccessory.context.device_params.keypadMac = lockKeypadProp[prop]
          
      }
    } 
    this.updating = false
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
          this.homeKitAccessory.context.device_params.iot_state = properties[prop]
            } else if (prop == 'single_press_type') {
              this.homeKitAccessory.context.device_params.single_press_type = properties[prop]
            } else if (prop == 'double_press_type') {
              this.homeKitAccessory.context.device_params.double_press_type = properties[prop]
            } else if (prop == 'triple_press_type') {
              this.homeKitAccessory.context.device_params.triple_press_type = properties[prop]
            } else if (prop == 'long_press_type') {
              this.homeKitAccessory.context.device_params.long_press_type = properties[prop]
            } else if (prop == 'switch-power'){
              this.homeKitAccessory.context.device_params.switch_power = properties[prop]
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


  async thermostatGetIotProp() {
    let keys = "trigger_off_val,emheat,temperature,humidity,time2temp_val,protect_time,mode_sys,heat_sp,cool_sp, current_scenario,config_scenario,temp_unit,fan_mode,iot_state,w_city_id,w_lat,w_lon,working_state, dev_hold,dev_holdtime,asw_hold,app_version,setup_state,wiring_logic_id,save_comfort_balance, kid_lock,calibrate_humidity,calibrate_temperature,fancirc_time,query_schedule"
    let response
    try {
      this.updating = true
      response = await this.plugin.client.thermostatGetIotProp(this.mac, keys)
      let properties = response.data.props
      const prop_key = Object.keys(properties);
      for (const element of prop_key) {
        const prop = element;
        if (prop === 'temperature') {
          this.homeKitAccessory.context.device_params.temperature = properties[prop]
        } else if (prop == 'cool_sp'){
          this.homeKitAccessory.context.device_params.cool_sp = properties[prop]
        } else if (prop == 'heat_sp'){
          this.homeKitAccessory.context.device_params.heat_sp = properties[prop]
        } else if (prop == 'working_state'){
          this.homeKitAccessory.context.device_params.working_state = properties[prop]
        } else if (prop == 'temp_unit'){
          this.homeKitAccessory.context.device_params.temp_unit = properties[prop]
        } else if (prop == 'mode_sys'){
          this.homeKitAccessory.context.device_params.mode_sys = properties[prop]
        } else if (prop == 'iot_state') {
          this.homeKitAccessory.context.conn_state = properties[prop]
        }
      }
      this.lastTimestamp = response.ts

    } catch(e) {
      this.plugin.log.debug("Error in thermostat: " + e)
    } finally {
      this.updating = false
      return response
    }
  }

  async setPreset(value) {
    const response = await this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, 'config_scenario', value)
    return response
}
// auto, on, off / / ['auto', 'circ', 'on']
  async setFanMode(value) {
    const response = await this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, 'fan_mode', value)
    return response
}
// auto, heat, cool
  async setHvacMode(value) {
    const response =await this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, 'mode_sys', value)
    return response
  }

  // heat stop point
  async setHeatPoint(value) {
    const response = await this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, 'heat_sp', value)
    return response
  }

  // Cool stop point
  async setCoolPoint(value) {
    const response = await this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, 'cool_sp', value)
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
