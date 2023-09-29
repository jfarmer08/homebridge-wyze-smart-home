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

 // From Device List
  get switch_state ()             { return this.homeKitAccessory.context.device_params.switch_state }
  get open_close_state ()         { return this.homeKitAccessory.context.device_params.open_close_state }
  
  // Wall Switch Prop
  get single_press_type ()        { return this.homeKitAccessory.context.device_params?.single_press_type }
  get double_press_type ()        { return this.homeKitAccessory.context.device_params?.double_press_type }
  get triple_press_type ()        { return this.homeKitAccessory.context.device_params?.triple_press_type }
  get long_press_type ()          { return this.homeKitAccessory.context.device_params?.long_press_type }
  get iot_state ()                { return this.homeKitAccessory.context.device_params?.iot_state } //Device online / offline
  get switch_power ()             { return this.homeKitAccessory.context.device_params?.switch_power } //Power on / Power off
  get switch_iot()                { return this.homeKitAccessory.context.device_params?.switch_iot}

  // Wall Switch Prop
  set single_press_type (value)        {  this.homeKitAccessory.context.device_params.single_press_type = value }
  set double_press_type (value)        {  this.homeKitAccessory.context.device_params.double_press_type = value }
  set triple_press_type (value)        {  this.homeKitAccessory.context.device_params.triple_press_type = value }
  set long_press_type (value)          {  this.homeKitAccessory.context.device_params.long_press_type = value }
  set iot_state (value)                {  this.homeKitAccessory.context.device_params.iot_state = value } //Device online / offline
  set switch_power (value)             {  this.homeKitAccessory.context.device_params.switch_power = value} //Power on / Power off
  set switch_iot(value)                {  this.homeKitAccessory.context.device_params.switch_iot = value}

  get cameraPowerSwitch ()        { return this.homeKitAccessory.context.device_params.power_switch}
  get cameraMotionSwitch ()       { return this.homeKitAccessory.context.device_params.motion_alarm_switch}
  get cameraNotification ()       { return this.homeKitAccessory.context.device_params?.notification}
  get cameraOn ()                 { return this.homeKitAccessory.context.device_params?.on}
  get cameraAvailable ()          { return this.homeKitAccessory.context.device_params?.available}
  get cameraSiren ()              { return this.homeKitAccessory.context.device_params?.cameraSiren}
  get cameraFloodLight ()         { return this.homeKitAccessory.context.device_params?.floodLight}
  get cameraGarageDoor ()         { return this.homeKitAccessory.context.device_params?.garageDoor}

  set cameraPowerSwitch (value)        {  this.homeKitAccessory.context.device_params.power_switch = value}
  set cameraMotionSwitch (value)       {  this.homeKitAccessory.context.device_params.motion_alarm_switch = value}
  set cameraNotification (value)       {  this.homeKitAccessory.context.device_params.notification = value}
  set cameraOn (value)                 {  this.homeKitAccessory.context.device_params.on = value}
  set cameraAvailable (value)          {  this.homeKitAccessory.context.device_params.available = value}
  set cameraSiren (value)              {  this.homeKitAccessory.context.device_params.cameraSiren = value}
  set cameraFloodLight (value)         {  this.homeKitAccessory.context.device_params.floodLight = value}
  set cameraGarageDoor (value)         {  this.homeKitAccessory.context.device_params.garageDoor = value}

  // Lock
  get lockOnoff_line() {return this.homeKitAccessory.context.device_params.onoff_line}
  get lockPower() {return this.homeKitAccessory.context.device_params.power}
  get lockDoor_open_status() {return this.homeKitAccessory.context.device_params.door_open_status}
  get lockHardlock() {return this.homeKitAccessory.context.device_params.hardlock}

  set lockcOnoff_line(value) { this.homeKitAccessory.context.device_params.onoff_line = value}
  set lockPower(value) { this.homeKitAccessory.context.device_params.power = value}
  set lockDoor_open_status(value) { this.homeKitAccessory.context.device_params.door_open_status = value}
  set lockHardlock(value) { this.homeKitAccessory.context.device_params.hardlock = value}

  // from HMS
  get hmsHmsID ()                 { return this.homeKitAccessory.context.device_params?.hmsId}
  get hmsStatus ()                { return this.homeKitAccessory.context.device_params?.hmsStatus}

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

  get thermostatTime2Temp()        { return this.homeKitAccessory.context.device_params?.time2temp_val }
  set thermostatTime2Temp(value)        { this.homeKitAccessory.context.device_params.time2temp_val = value }

  get thermostatConnState()       { return this.homeKitAccessory.context.conn_state }

  /** Determines whether this accessory matches the given Wyze device */
  matches (device) {
    return this.mac === device.mac
  }

  async update (device, timestamp) {
    const productType = device.product_type

    switch (productType) {
      case "OutdoorPlug":
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
      case "Plug":
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
      case "Common":
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
            triple_press_type: this.triple_press_type,
            long_press_type: this.long_press_type,
            switch_iot: this.switch_iot,
          },
        }
        break
      case "Camera":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          device_params: device.device_params = {
            ssid : device.device_params.ssid,
            ip : device.device_params.ip,
            power_switch : device.device_params.power_switch,
            notification : this.cameraNotification,
            on : this.cameraOn,
            available : this.cameraAvailable,
            siren : this.cameraSiren,
            floodLight : this.cameraFloodLight,
            garageDoor : this.cameraGarageDoor,
          },
        }
        break
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
            open_close_state: device.device_params.open_close_state
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
          mode_sys: this.thermostatModeSys,
          time2temp_val: this.thermostatTime2Temp
        }        
      }
      break
      case "S1Gateway":
        this.getHmsUpdate()
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          device_params: device.device_params = {
            battery: device.device_params.battery,
            indicator_light_switch: device.device_params.indicator_light_switch,
            power_source: device.device_params.power_source,
            ssid: device.device_params.ssid,
            ip: device.device_params.ip,
            rssi: device.device_params.rssi
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

  async getLockProperty() {
    // Set Defaults
    this.lockcOnoff_line = 0
    this.lockPower = 0
    this.lockDoor_open_status = 0
    this.lockHardlock = 0

    const propertyList = await this.plugin.client.getLockInfo(this.mac, this.product_model)
    let lockProperties = propertyList.device
    const prop_key = Object.keys(lockProperties)
    for (const element of prop_key) {
      const prop = element;
      switch (prop) {
        case "onoff_line":
          this.lockcOnoff_line = lockProperties[prop]
          break
        case "power":
          this.lockPower = lockProperties[prop]
          break
        case "door_open_status":
          this.lockDoor_open_status = lockProperties[prop]
          break
        case "trash_mode":
          this.homeKitAccessory.context.device_params.trash_mode = lockProperties[prop]
          break
        case "keypad_enable_status":
          this.homeKitAccessory.context.device_params.keypad_enable_status = lockProperties[prop]
          break
        case "door_sensor":
          this.homeKitAccessory.context.device_params.door_sensor = lockProperties[prop]
          break
      }
    }
    let lockerStatusProperties = propertyList.device.locker_status
    const prop_keyLock = Object.keys(lockerStatusProperties)
    for (const element of prop_keyLock) {
      const prop = element;
      switch (prop){
        case "door":
          this.homeKitAccessory.context.device_params.door = lockerStatusProperties[prop]
          break
        case "hardlock":
          this.homeKitAccessory.context.device_params.hardlock = lockerStatusProperties[prop]
          break
      }
    }
  }

  async wallSwitchGetIotProp() {
    // Set Defaults
    this.switch_power = false
    this.switch_iot = false
    this.iot_state = "connected"
    this.double_press_type = 1
    this.single_press_type = 1
    this.triple_press_type = 1
    this.long_press_type = false

    let keys = "iot_state,switch-power,switch-iot,single_press_type, double_press_type, triple_press_type, long_press_type"
      const propertyList = await this.plugin.client.getIotProp(this.mac, keys)
      for (const prop of Object.keys(propertyList.data.props)) {
        switch (prop) {
          case 'iot_state':
            this.homeKitAccessory.context.device_params.iot_state = propertyList.data.props[prop]
            break
          case 'single_press_type':
            this.homeKitAccessory.context.device_params.single_press_type = propertyList.data.props[prop]
            break
          case 'double_press_type':
            this.homeKitAccessory.context.device_params.double_press_type = propertyList.data.props[prop]
          case 'triple_press_type':
            this.homeKitAccessory.context.device_params.triple_press_type = propertyList.data.props[prop]
            break
          case 'long_press_type':
            this.homeKitAccessory.context.device_params.long_press_type = propertyList.data.props[prop]
            break
          case 'switch-power':
            this.homeKitAccessory.context.device_params.switch_power = propertyList.data.props[prop]
            break
          case 'switch-iot':
            this.homeKitAccessory.context.device_params.switch_iot = propertyList.data.props[prop]
            break
        }
      }
  }
  
  async getCameraPropertyList () {
    // Set Default
    this.cameraNotification = 0
    this.cameraOn = 0
    this.cameraAvailable = 0
    this.cameraSiren = 0
    this.cameraFloodLight = 0
    this.cameraGarageDoor = 0

    const cameraProperty = {  
      NOTIFICATION : "P1",
      ON : "P3",
      AVAILABLE : "P5",
      CAMERA_SIREN : 'P1049',
      FLOOD_LIGHT : 'P1056',
      GARAGE_DOOR : 'P1301'
    }
    const propertyList = await this.plugin.client.getDevicePID(this.mac, this.product_model)
    for (const property of propertyList.data.property_list) {
      switch (property.pid) {
        case cameraProperty.NOTIFICATION:
          this.homeKitAccessory.context.device_params.notification = property.value
          break
        case cameraProperty.ON:
          this.homeKitAccessory.context.device_params.on = property.value
          break
        case cameraProperty.AVAILABLE:
          this.homeKitAccessory.context.device_params.available = property.value
          break
        case cameraProperty.CAMERA_SIREN:
          this.homeKitAccessory.context.device_params.siren = property.value
          break
        case cameraProperty.FLOOD_LIGHT:
         this.homeKitAccessory.context.device_params.floodLight = property.value
         break
        case cameraProperty.GARAGE_DOOR:
        this.homeKitAccessory.context.device_params.garageDoor = property.value
        break
      }
    }
  }

  //HMS
  async getHmsID() {
    const response = this.plugin.client.getPlanBindingListByUser()
    this.homeKitAccessory.context.device_params.hmsId = response.data[0].deviceList[0].device_id
  }

  async getHmsUpdate() {

    const hmsID = await this.plugin.client.getPlanBindingListByUser()
    this.homeKitAccessory.context.device_params.hmsId = hmsID.data[0].deviceList[0].device_id

    const response = await this.plugin.client.monitoringProfileStateStatus(hmsID.data[0].deviceList[0].device_id)

    this.homeKitAccessory.context.device_params.hmsStatus = response.message
  }

  // Thermostat Methods
  async thermostatGetIotProp() {
    // Set Defaults
    this.thermostatTemperature = 69.0
    this.thermostatCoolSetpoint = 65.0
    this.thermostatHeatSetpoint = 72.0
    this.thermostatModeSys = "auto"
    this.thermostatWorkingState = "idle"
    this.thermostatTempUnit = "F"

    let keys = "trigger_off_val,emheat,temperature,humidity,time2temp_val,protect_time,mode_sys,heat_sp,cool_sp, current_scenario,config_scenario,temp_unit,fan_mode,iot_state,w_city_id,w_lat,w_lon,working_state, dev_hold,dev_holdtime,asw_hold,app_version,setup_state,wiring_logic_id,save_comfort_balance, kid_lock,calibrate_humidity,calibrate_temperature,fancirc_time,query_schedule"
    let response
    try {
      this.updating = true
      response = await this.plugin.client.thermostatGetIotProp(this.mac, keys)
      let properties = response.data.props
      const prop_key = Object.keys(properties);
      for (const element of prop_key) {
        const prop = element;
        switch (prop) {
          case 'temperature': 
            this.homeKitAccessory.context.device_params.temperature = Math.round(properties[prop])
            continue
          case 'cool_sp':
            this.homeKitAccessory.context.device_params.cool_sp = Math.round(properties[prop])
            continue
          case 'heat_sp':
            this.homeKitAccessory.context.device_params.heat_sp = Math.round(properties[prop])
            continue
          case 'working_state':
            this.homeKitAccessory.context.device_params.working_state = properties[prop]
            continue
          case 'temp_unit':
            this.homeKitAccessory.context.device_params.temp_unit = properties[prop]
            continue
          case 'mode_sys':
            this.homeKitAccessory.context.device_params.mode_sys = properties[prop]
            continue
          case 'iot_state':
            this.homeKitAccessory.context.conn_state = properties[prop]
            continue
          case 'time2temp_val':
            this.homeKitAccessory.context.device_params.thermostatTime2Temp = properties[prop]
            continue
        }
      }
        this.lastTimestamp = response.ts
    } catch(e) {
      this.plugin.log.error("Error in thermostat: " + e)
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

  cameraAccessoryAttached() {
    if(this.plugin.config.garageDoorAccessory?.find(d => d === this.mac) || this.plugin.config.spotLightAccessory?.find(d => d === this.mac) ||
    this.plugin.config.alarmAccessory?.find(d => d === this.mac) || this.plugin.config.floodLightAccessory?.find(d => d === this.mac)){
      return true
    } else return false
  }
}
