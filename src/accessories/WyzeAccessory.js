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
 get cameraNotification ()        { return this.homeKitAccessory.context.device_params?.notification}
 get cameraOn ()        { return this.homeKitAccessory.context.device_params?.on}
 get cameraAvailable ()        { return this.homeKitAccessory.context.device_params?.available}
 get cameraSiren ()        { return this.homeKitAccessory.context.device_params?.cameraSiren}
 get cameraFloodLight ()        { return this.homeKitAccessory.context.device_params?.floodLight}

 // from HMS
 get hmsHmsID ()        { return this.homeKitAccessory.context.device_params?.hmsId}
 get hmsStatus ()        {return this.homeKitAccessory.context.device_params?.hmsStatus}


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
            ssid : device.device_params.ssid,
            ip : device.device_params.ip,
            power_switch : device.device_params.power_switch,
            notification : this.cameraNotification,
            on : this.cameraOn,
            available : this.cameraAvailable,
            siren : this.cameraSiren,
            floodLight : this.cameraFloodLight,
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
      case "S1Gateway":
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
            rssi: device.device_params.rssi,
            hmsID: this.hmsHmsID,
            hmsStatus: this.hmsStatus
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
  async lockGetProperty() {
    this.updating = true
    const propertyList = await this.plugin.client.getLockInfo(this.mac, this.product_model)
    let lockProperties = propertyList.device
    const prop_key = Object.keys(lockProperties)
    for (const element of prop_key) {
      const prop = element;
      switch (prop) {
        case "onoff_line":
          this.homeKitAccessory.context.device_params.onoff_line = lockProperties[prop]
          continue
        case "power":
          this.homeKitAccessory.context.device_params.power = lockProperties[prop]
          continue
        case "door_open_status":
          this.homeKitAccessory.context.device_params.door_open_status = lockProperties[prop]
          continue
        case "trash_mode":
          this.homeKitAccessory.context.device_params.trash_mode = lockProperties[prop]
          continue
        case "keypad_enable_status":
          this.homeKitAccessory.context.device_params.keypad_enable_status = lockProperties[prop]
          continue
        case "door_sensor":
          this.homeKitAccessory.context.device_params.door_sensor = lockProperties[prop]
          continue
      }
    }
    let lockerStatusProperties = propertyList.device.locker_status
    const prop_keyLock = Object.keys(lockerStatusProperties)
    for (const element of prop_keyLock) {
      const prop = element;
      switch (prop){
        case "door":
          this.homeKitAccessory.context.device_params.door = lockerStatusProperties[prop]
          continue
        case "hardlock":
          this.homeKitAccessory.context.device_params.hardlock = lockerStatusProperties[prop]
          continue
      }
    } 
    let lockKeypadProperties = propertyList.device.keypad
    const prop_keypad = Object.keys(lockKeypadProperties)
    for (const element of prop_keypad) {
      const prop = element
      switch (prop ) {
        case "power":
          this.homeKitAccessory.context.device_params.keypadPower = lockKeypadProperties[prop]
          continue
        case "onoff_line":
          this.homeKitAccessory.context.device_params.keypadOnoff_line = lockKeypadProperties[prop]
          continue
      }
    } 
    let lockKeypadProp = propertyList.device.keypad.hardware_info
    const prop_keypadProp = Object.keys(lockKeypadProp)
    for (const element of prop_keypadProp) {
      const prop = element
      switch (prop ) {
        case "mac":
          this.homeKitAccessory.context.device_params.keypadMac = lockKeypadProp[prop]
          continue
      }
    } 
    this.updating = false
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

  //Camera
  async cameraTurnOn() { await this.runActionList(this.mac, this.product_model, "P3", 'power_on')}

  async cameraTurnOff() { await this.runActionList(this.mac, this.product_model, "P3", 'power_off')}

  async cameraSirenOn() { await this.runActionList(this.mac, this.product_model, "P1049", 'siren_on')}

  async cameraSirenOff() { await this.runActionList(this.mac, this.product_model, "P1049", 'siren_off')}

  async cameraFloodLightOn() { await this.setProperty(this.mac, this.product_model, "P1049", "1")}

  async cameraFloodLightOff() { await this.setProperty(this.mac, this.product_model, "P1049", "2")}

  async turnOnNotifications() { await this.setProperty(this.mac, this.product_model, "P1", "1")}

  async turnOffNotifications() { await this.setProperty(this.mac, this.product_model, "P1", "0")}

  async getCameraPropertyList () {

    const cameraProperty = {  
      NOTIFICATION : "P1",
      ON : "P3",
      AVAILABLE : "P5",
      CAMERA_SIREN : "P1049",
      FLOOD_LIGHT : "P1056",
    }

    const propertyList = await this.getPropertyList(this.mac, this.product_model)
    for (const property of propertyList.data.property_list) {
      switch (property.pid) {
        case cameraProperty.NOTIFICATION:
          this.homeKitAccessory.context.device_params.notification = property.value
        case cameraProperty.ON:
          this.homeKitAccessory.context.device_params.on = property.value
        case cameraProperty.AVAILABLE:
          this.homeKitAccessory.context.device_params.available = property.value
        case cameraProperty.CAMERA_SIREN:
          this.homeKitAccessory.context.device_params.cameraSiren = property.value
        case cameraProperty.FLOOD_LIGHT:
          this.homeKitAccessory.context.device_params.floodLight = property.value
      }
    }
  }
  //WyzeLight
  async lightTurnOn() { await this.setProperty(this.mac, this.product_model, "P3", "0")}
  async lightTurnOff() { await this.setProperty(this.mac, this.product_model, "P3", "1")}
  async lightSetBrightness(value) { await this.setProperty(this.mac, this.product_model, "P1501", value)}
  async setColorTemperature(value) { await this.setProperty(this.mac, this.product_model, "P1502", value)}

  //HMS
  async getHmsID() {
    const response = await this.plugin.client.getPlanBindingListByUser()
        this.homeKitAccessory.context.device_params.hmsId = response.data[0].deviceList[0].device_id
  }
  
  async setHMSState(hms_id, mode) {
    let responseDisable
    let response
    console.log(hms_id)
    console.log(mode)
      if(mode == "off") {
      responseDisable = await this.plugin.client.disableRemeAlarm(hms_id)
      console.log(responseDisable)
      response = await this.plugin.client.monitoringProfileActive(hms_id, 0, 0)
      } else if( mode === "away" ) {
      response = await this.plugin.client.monitoringProfileActive(hms_id, 0, 1)
      }  else if( mode === "home" ) {
      response = await this.plugin.client.monitoringProfileActive(hms_id, 1, 0)
      }
      console.log(response)
      return response
  }

  async getHmsUpdate(hms_id) {
    const response = await this.plugin.client.monitoringProfileStateStatus(hms_id)
      this.homeKitAccessory.context.device_params.hmsStatus = response.message
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

    //HMS
    async getHmsID() {
      //need to phrase out HMSID from devices-deviceList and return that
      const response = await this.plugin.client.getPlanBindingListByUser()
        console.log(response.data[0].deviceList[0].device_id)
         this.homeKitAccessory.context.device_params.hmsId = response.data[0].deviceList[0].device_id
    }
  
    async setHMSState(hms_id, mode) {
      let response
       if(mode == "disarm") {
        response = await this.plugin.client.disableRemeAlarm(hms_id)
        response = await this.plugin.client.monitoringProfileActive(hms_id, 0, 0)
       } else if( mode === "away" ) {
        response = await this.plugin.client.monitoringProfileActive(hms_id, 0, 1)
       }  else if( mode === "home" ) {
        response = await this.plugin.client.monitoringProfileActive(hms_id, 1, 0)
       }
       return response
    }
  
    async getHmsUpdate(hms_id) {
      const response = await this.plugin.client.monitoringProfileStateStatus(hms_id)
        this.homeKitAccessory.context.device_params.hmsStatus = response.message
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
