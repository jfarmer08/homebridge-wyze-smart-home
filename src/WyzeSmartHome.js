const { homebridge, Accessory, UUIDGen } = require('./types')
const { OutdoorPlugModels, PlugModels, CommonModels, CameraModels, LeakSensorModels,
  TemperatureHumidityModels, LockModels, LockBoltV2Models, MotionSensorModels, ContactSensorModels, LightModels,
  LightStripModels, MeshLightModels, ThermostatModels, S1GatewayModels } = require('./enums')

const WyzeAPI = require('wyze-api')
const WyzePlug = require('./accessories/WyzePlug')
const WyzeLight = require('./accessories/WyzeLight')
const WyzeMeshLight = require('./accessories/WyzeMeshLight')
const WyzeLock = require('./accessories/WyzeLock')
const WyzeLockBoltV2 = require('./accessories/WyzeLockBoltV2')
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
const DEFAULT_SECURITY_REFRESH_INTERVAL = 10000

// Accessories that make their own API call in updateCharacteristics and return
// a boolean indicating whether state changed — safe to fast-poll independently.
const FAST_POLL_CLASSES = new Set([WyzeLock, WyzeLockBoltV2])

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
    this._fastPollStats = new Map()
    this._knownUnsupported = new Set()

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
      apiLogEnabled: this.config.apiLogEnabled,
      //App Config
      lowBatteryPercentage: this.config.lowBatteryPercentage,
      //Storage Path
      persistPath: homebridge.user.persistPath(),
      //URLs
      authBaseUrl: this.config.authBaseUrl,
      // Default the /app API to app.wyzecam.com (DigiCert Global Root G2) instead of the
      // wyze-api default api.wyzecam.com (legacy DigiCert Global Root G1). Node 24.18.0+
      // dropped the G1 root from its bundled trust store, breaking get_object_list with
      // UNABLE_TO_GET_ISSUER_CERT_LOCALLY. app.wyzecam.com serves the same API over a G2
      // chain that Node still trusts. Still overridable via config.apiBaseUrl.
      apiBaseUrl: this.config.apiBaseUrl || 'https://app.wyzecam.com',
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
    this.runLockFastPollLoop()
  }

  async runLoop() {
    const interval = this.config.refreshInterval || DEFAULT_REFRESH_INTERVAL
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.refreshDevices()
      } catch (e) {
        this.log.error(`[Plugin] Refresh failed: ${e}`)
      }

      await delay(interval)
    }
  }

  async runLockFastPollLoop() {
    const interval = this.config.securityRefreshInterval || DEFAULT_SECURITY_REFRESH_INTERVAL
    await delay(interval)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.refreshLockDevices()
      } catch (e) { }
      await delay(interval)
    }
  }

  async refreshLockDevices() {
    const targets = this.accessories.filter(a => FAST_POLL_CLASSES.has(a.constructor) && a.lastDevice)
    if (targets.length === 0) return

    let changedDevices = []
    for (const accessory of targets) {
      const mac = accessory.mac
      if (!this._fastPollStats.has(mac)) {
        this._fastPollStats.set(mac, { name: accessory.display_name, model: accessory.model_name, attempts: 0, successes: 0, since: new Date() })
      }
      const stats = this._fastPollStats.get(mac)
      stats.attempts++
      try {
        const changed = await accessory.updateCharacteristics(accessory.lastDevice)
        stats.successes++
        if (changed) changedDevices.push(`${accessory.display_name} [${accessory.model_name}]`)
      } catch (e) { }
    }

    if (changedDevices.length > 0) {
      if (this.config.pluginLoggingEnabled)
        this.log(`[LockFastPoll] State change detected for ${changedDevices.join(', ')}, triggering full refresh`)
      await this.refreshDevices()
    }
  }

  async refreshDevices() {
    let fastPollSummary = ''
    if (this._fastPollStats.size > 0) {
      const parts = []
      for (const [, stats] of this._fastPollStats) {
        parts.push(`${stats.name} [${stats.model}]: ${stats.successes}/${stats.attempts} fast polls`)
      }
      fastPollSummary = ` (${parts.join(', ')})`
    }
    this._fastPollStats = new Map()

    try {
      const objectList = await this.client.getObjectList()
      const timestamp = objectList.ts
      const devices = objectList.data.device_list

      await this.loadDevices(devices, timestamp)
      if (this.config.pluginLoggingEnabled) this.log(`Refreshed ${this.accessories.length}/${devices.length} devices${fastPollSummary}`)
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
      if (this.config.pluginLoggingEnabled) this.log(`Removing ${removedAccessories.length} device(s)`)
      const removedHomeKitAccessories = removedAccessories.map(a => a.homeKitAccessory)
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removedHomeKitAccessories)
    }

    this.accessories = foundAccessories
  }

  async loadDevice(device, timestamp) {
    const accessoryClass = this.getAccessoryClass(device.product_type, device.product_model, device.mac, device.nickname)
    if (!accessoryClass) {
      if (this.config.pluginLoggingEnabled && !this._knownUnsupported.has(device.mac)) {
        this._knownUnsupported.add(device.mac)
        this.log(`[${device.product_type}] Unsupported device type: (Name: ${device.nickname}) (MAC: ${device.mac}) (Model: ${device.product_model})`)
      }
      return
    }
    else if (this.config.filterByMacAddressList?.find(d => d === device.mac) || this.config.filterDeviceTypeList?.find(d => d === device.product_type)) {
      if (this.config.pluginLoggingEnabled) this.log(`[${device.product_type}] Ignoring (${device.nickname}) (MAC: ${device.mac}) because it is in the Ignore Device list`)
      return
    }
    else if (device.product_type == 'S1Gateway' && this.config.hms == false) {
      if (this.config.pluginLoggingEnabled) this.log(`[${device.product_type}] Ignoring (${device.nickname}) (MAC: ${device.mac}) because it is not enabled`)
      return
    }


    let accessory = this.accessories.find(a => a.matches(device))
    if (!accessory) {
      const homeKitAccessory = this.createHomeKitAccessory(device)
      accessory = new accessoryClass(this, homeKitAccessory)
      this.accessories.push(accessory)
    }
    accessory.update(device, timestamp)

    return accessory
  }

  getAccessoryClass(type, model) {
    switch (type) {
      case 'OutdoorPlug':
        return Object.values(OutdoorPlugModels).includes(model) ? WyzePlug : null
      case 'Plug':
        return Object.values(PlugModels).includes(model) ? WyzePlug : null
      case 'Light':
        return Object.values(LightModels).includes(model) ? WyzeLight : null
      case 'MeshLight':
        return Object.values(MeshLightModels).includes(model) ? WyzeMeshLight : null
      case 'LightStrip':
        return Object.values(LightStripModels).includes(model) ? WyzeMeshLight : null
      case 'ContactSensor':
        return Object.values(ContactSensorModels).includes(model) ? WyzeContactSensor : null
      case 'MotionSensor':
        return Object.values(MotionSensorModels).includes(model) ? WyzeMotionSensor : null
      case 'Lock':
        return Object.values(LockModels).includes(model) ? WyzeLock : null
      case 'TemperatureHumidity':
        return Object.values(TemperatureHumidityModels).includes(model) ? WyzeTemperatureHumidity : null
      case 'LeakSensor':
        return Object.values(LeakSensorModels).includes(model) ? WyzeLeakSensor : null
      case 'Camera':
        return Object.values(CameraModels).includes(model) ? WyzeCamera : null
      case 'Common':
        if (Object.values(LockBoltV2Models).includes(model)) return WyzeLockBoltV2
        if (Object.values(CommonModels).includes(model)) return WyzeSwitch
        return null
      case 'S1Gateway':
        return Object.values(S1GatewayModels).includes(model) ? WyzeHMS : null
      case 'Thermostat':
        return Object.values(ThermostatModels).includes(model) ? WyzeThermostat : null
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
        this.log.error(`Error removing accessory ${homeKitAccessory.context.nickname} (MAC: ${homeKitAccessory.context.mac}) : ${error}`)
      }
    }
  }
}
