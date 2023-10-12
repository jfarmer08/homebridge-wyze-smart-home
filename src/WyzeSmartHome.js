const { homebridge, Accessory, UUIDGen } = require('./types')
const { OutdoorPlugModels, PlugModels, CommonModels, CameraModels, NotSupportedModels ,LeakSensorModels, 
      TemperatureHumidityModels, LockModels, MotionSensorModels, ContactSensorModels, LightModels, 
      LightStripModels, MeshLightModels, ThermostatModels, S1GatewayModels } = require('./enums')

const WyzeAPI = require('./wyze-api/src')
const WyzePlug = require('./accessories/WyzePlug')
const WyzeLight = require('./accessories/WyzeLight')
const WyzeMeshLight = require('./accessories/WyzeMeshLight')
const WyzeLock = require('./accessories/WyzeLock')
const WyzeContactSensor = require('./accessories/WyzeContactSensor')
const WyzeMotionSensor = require('./accessories/WyzeMotionSensor')
const WyzeTemperatureHumidity = require('./accessories/WyzeTemperatureHumidity')
const WyzeLeakSensor = require('./accessories/WyzeLeakSensor')
const WyzeCamera = require('./accessories/WyzeCamera')
const WyzeSwitch = require('./accessories/WyzeSwitch')
const WyzeHMS = require('./accessories/WyzeHMS')
const WyzeThermostat = require('./accessories/WyzeThermostat')

const PLUGIN_NAME = 'homebridge-wyze-smart-home'
const PLATFORM_NAME = 'WyzeSmartHome'

const DEFAULT_REFRESH_INTERVAL = 30000

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = class WyzeSmartHome {
  constructor(log, config, api) {
    this.log = log
    this.config = config
    this.api = api
    this.client = this.getClient()

    this.accessories = []

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this))
  }

  static register() {
    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, WyzeSmartHome)
  }

  getClient() {
    return new WyzeAPI({
      // User login parameters
      username: this.config.username,
      password: this.config.password,
      mfaCode: this.config.mfaCode,
      keyId: this.config.keyId,
      apiKey: this.config.apiKey,
      //Logging
      logLevel: this.config.logLevel,
      apiLogEnabled: this.config.apiLogEnabled,
      //Storage Path
      persistPath: homebridge.user.persistPath(),
      //URLs
      authBaseUrl: this.config.authBaseUrl,
      apiBaseUrl: this.config.apiBaseUrl,
      // App emulation constants
      authApiKey: this.config.authApiKey,
      phoneId: this.config.phoneId,
      appName: this.config.appName,
      appVer: this.config.appVer,
      appVersion: this.config.appVersion,
      userAgent: this.config.userAgent,
      sc: this.config.sc,
      sv: this.config.sv,
    // Crypto Secrets
      fordAppKey: this.config.fordAppKey, // Required for Locks
      fordAppSecret: this.config.fordAppSecret, // Required for Locks
      oliveSigningSecret: this.config.oliveSigningSecret, // Required for the thermostat
      oliveAppId: this.config.oliveAppId, //  Required for the thermostat
      appInfo: this.config.appInfo // Required for the thermostat
    }, this.log)
  }

  didFinishLaunching() {
    this.runLoop()
  }

  async runLoop() {
    const interval = this.config.refreshInterval || DEFAULT_REFRESH_INTERVAL
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.refreshDevices()
      } catch (e) { }

      await delay(interval)
    }
  }

  async refreshDevices() {
    if(this.config.logLevel == "debug") this.log('Refreshing devices...')

    try {
      const objectList = await this.client.getObjectList()
      const timestamp = objectList.ts
      const devices = objectList.data.device_list

      if(this.config.logLevel == "debug") this.log(`Found ${devices.length} device(s)`)
      await this.loadDevices(devices, timestamp)
    } catch (e) {
      this.log.error(`Error getting devices: ${e}`)
      throw e
    }
  }

  async loadDevices(devices, timestamp) {
    const foundAccessories = []

    for (const device of devices) {
      const accessory = await this.loadDevice(device, timestamp)
      if (accessory) {
        foundAccessories.push(accessory)
      }
    }

    const removedAccessories = this.accessories.filter(a => !foundAccessories.includes(a))
    if (removedAccessories.length > 0) {
      if(this.config.logLevel == "info" || "debug") this.log(`Removing ${removedAccessories.length} device(s)`)
      const removedHomeKitAccessories = removedAccessories.map(a => a.homeKitAccessory)
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removedHomeKitAccessories)
    }

    this.accessories = foundAccessories
  }

  async loadDevice(device, timestamp) {
    const accessoryClass = this.getAccessoryClass(device.product_type, device.product_model, device.mac, device.nickname)
    if (!accessoryClass) {
      if(this.config.logLevel == "debug") this.log(`[${device.product_type}] Unsupported device type: (Name: ${device.nickname}) (MAC: ${device.mac}) (Model: ${device.product_model})`)
      return
    } 
    else if (this.config.filterByMacAddressList?.find(d => d === device.mac) || this.config.filterDeviceTypeList?.find(d => d === device.product_type)) 
      {
        if(this.config.logLevel == "debug") this.log(`[${device.product_type}] Ignoring (${device.nickname}) (MAC: ${device.mac}) because it is in the Ignore Device list`)
        return
      } 
    else if (device.product_type == 'S1Gateway' && this.config.hms == false)
      { 
        if(this.config.logLevel == "debug") this.log(`[${device.product_type}] Ignoring (${device.nickname}) (MAC: ${device.mac}) because it is not enabled`)
        return
      }
      

    let accessory = this.accessories.find(a => a.matches(device))
    if (!accessory) {
      const homeKitAccessory = this.createHomeKitAccessory(device)
      accessory = new accessoryClass(this, homeKitAccessory)
      this.accessories.push(accessory)
    } else {
      if(this.config.logLevel == "debug") this.log(`[${device.product_type}] Loading accessory from cache ${device.nickname} (MAC: ${device.mac})`)
    }
      accessory.update(device, timestamp)    

    return accessory
  }

  getAccessoryClass(type, model) {
    switch (type) {
      case 'OutdoorPlug':
        if(Object.values(OutdoorPlugModels).includes(model)){ return WyzePlug } 
      case 'Plug':
        if(Object.values(PlugModels).includes(model)){ return WyzePlug }
      case 'Light':
        if(Object.values(LightModels).includes(model)){ return WyzeLight }
      case 'MeshLight':
        if(Object.values(MeshLightModels).includes(model)){ return WyzeMeshLight }
      case 'LightStrip':
        if(Object.values(LightStripModels).includes(model)){ return WyzeMeshLight } 
      case 'ContactSensor':
        if(Object.values(ContactSensorModels).includes(model)){ return WyzeContactSensor }
      case 'MotionSensor':
        if(Object.values(MotionSensorModels).includes(model)){ return WyzeMotionSensor }
      case 'Lock':
        if(Object.values(LockModels).includes(model)){ return WyzeLock }
      case 'TemperatureHumidity':
        if(Object.values(TemperatureHumidityModels).includes(model)){ return WyzeTemperatureHumidity } 
      case 'LeakSensor':
        if(Object.values(LeakSensorModels).includes(model)){ return WyzeLeakSensor } 
      case 'Camera':
        if(Object.values(CameraModels).includes(model)){ return WyzeCamera }
      case 'Common':
        if(Object.values(CommonModels).includes(model)){ return WyzeSwitch }
      case 'S1Gateway':
        if(Object.values(S1GatewayModels).includes(model)){return WyzeHMS }
      case 'Thermostat':
        if(Object.values(ThermostatModels).includes(model)){ return WyzeThermostat } 
    }
  }

  createHomeKitAccessory(device) {
    const uuid = UUIDGen.generate(device.mac)

    const homeKitAccessory = new Accessory(device.nickname, uuid)

    homeKitAccessory.context = {
      mac: device.mac,
      product_type: device.product_type,
      product_model: device.product_model,
      nickname: device.nickname
    }

    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory])
    return homeKitAccessory
  }

  // Homebridge calls this method on boot to reinitialize previously-discovered devices
  configureAccessory(homeKitAccessory) {
    // Make sure we haven't set up this accessory already
    let accessory = this.accessories.find(a => a.homeKitAccessory === homeKitAccessory)
    if (accessory) {
      return
    }

    const accessoryClass = this.getAccessoryClass(homeKitAccessory.context.product_type, homeKitAccessory.context.product_model)
    if (accessoryClass) {
      accessory = new accessoryClass(this, homeKitAccessory)
      this.accessories.push(accessory)
    } else {
      try {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory])
      } catch (error) {
        this.log.error(`[${device.product_type}] Error removing accessory ${homeKitAccessory.context.nickname} (MAC: ${homeKitAccessory.context.mac}) : ${error}`)
      }
    }
  }
}