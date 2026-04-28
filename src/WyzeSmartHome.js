const { homebridge, Accessory, UUIDGen, Categories } = require('./types')
const enums = require('./enums')
const { OutdoorPlugModels, PlugModels, CommonModels, CameraModels, LeakSensorModels,
  TemperatureHumidityModels, LockModels, LockBoltV2Models, MotionSensorModels, ContactSensorModels, LightModels,
  LightStripModels, MeshLightModels, ThermostatModels, ThermostatRoomSensor, S1GatewayModels,
  VacuumModels, IrrigationModels } = enums

//const WyzeAPI = require('wyze-api') // Uncomment for Release
const WyzeAPI = require('./wyze-api/src') // Comment for Release
const { wrapLogger, resolveSecrets, getValidatedBaseUrls, sanitizeDeviceName } = require('./security')
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
const WyzeRoomSensor = require('./accessories/WyzeRoomSensor')
const WyzeVacuum = require('./accessories/WyzeVacuum')
const WyzeIrrigation = require('./accessories/WyzeIrrigation')

const PLUGIN_NAME = 'homebridge-wyze-smart-home'
const PLATFORM_NAME = 'WyzeSmartHome'

const DEFAULT_REFRESH_INTERVAL = 30000

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = class WyzeSmartHome {
  constructor(log, config, api) {
    // Sanitize all log output: redact bearer tokens, access_token / refresh_token,
    // passwords, API keys, and MAC addresses. Strips control chars and bounds line
    // length. Applies to every downstream consumer that uses this.log (including
    // the WyzeAPI client, which we pass it to below).
    this.log = wrapLogger(log)
    // Merge in credentials from secretsFile (if configured) and WYZE_* env vars,
    // and validate / lock down the auth/api base URLs to known Wyze hosts.
    this.config = resolveSecrets(config, this.log)
    Object.assign(this.config, getValidatedBaseUrls(this.config, this.log))
    this.api = api

    // Apply user-supplied product-code overrides BEFORE constructing the
    // client or scanning devices, so getAccessoryClass sees the extended
    // model maps. Lets users route a brand-new Wyze model to an existing
    // handler class for testing without waiting for a plugin release.
    const overrideResult = enums.applyConfigOverrides(this.config.deviceTypeOverrides, this.log)
    if (overrideResult.added > 0) {
      this.log.info?.(
        `[enums] Applied ${overrideResult.added} model override(s) from config` +
        (overrideResult.skipped > 0 ? `; ${overrideResult.skipped} already present` : '') +
        (overrideResult.unknownCategories.length ? `; ignored unknown categor${overrideResult.unknownCategories.length === 1 ? 'y' : 'ies'}: ${overrideResult.unknownCategories.join(', ')}` : '')
      )
    }

    this.client = this.getClient()

    this.accessories = []

    process.on('unhandledRejection', (reason) => {
      this.log.error(`Unhandled promise rejection: ${reason?.stack ?? reason}`)
    })
    process.on('uncaughtException', (err) => {
      this.log.error(`Uncaught exception: ${err.stack ?? err}`)
    })

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
    if (this.config.pluginLoggingEnabled) this.log('Refreshing devices...')

    try {
      const objectList = await this.client.getObjectList()
      const timestamp = objectList.ts
      const devices = objectList?.data?.device_list

      if (!Array.isArray(devices)) {
        this.log.error(`Error getting devices: unexpected response from getObjectList (device_list missing)`)
        return
      }

      if (this.config.pluginLoggingEnabled) this.log(`Found ${devices.length} device(s)`)

      // Wyze Room Sensors (CO_TH1) aren't returned by the bulk getObjectList
      // — they hang off a thermostat as sub-devices. Discover them via
      // getThermostatSensors and synthesize device entries so they flow
      // through the same loadDevice / accessory-update path as everything
      // else. Opt-in via config so users without room sensors don't pay
      // for the extra API call per refresh.
      if (this.config.enableThermostatRoomSensors) {
        const roomSensors = await this.discoverRoomSensors(devices)
        for (const rs of roomSensors) devices.push(rs)
      }

      await this.loadDevices(devices, timestamp)
    } catch (e) {
      this.log.error(`Error getting devices: ${e}`)
      throw e
    }
  }

  /**
   * For each thermostat in `devices`, fetch its paired Wyze Room Sensors
   * (CO_TH1) via the Earth `get_sub_device` endpoint and return them as
   * synthetic device entries that loadDevice can consume.
   *
   * One extra API call per thermostat per refresh cycle.
   *
   * The Earth endpoint shape isn't publicly documented and varies across
   * firmwares — this method logs aggressively (once per startup per
   * thermostat) so unexpected shapes are easy to diagnose from a user's
   * log dump.
   */
  async discoverRoomSensors(devices) {
    const thermostats = devices.filter(
      (d) => d.product_type === 'Thermostat' && Object.values(ThermostatModels).includes(d.product_model)
    )
    if (thermostats.length === 0) return []

    if (!this._roomSensorRawLogged) this._roomSensorRawLogged = new Set()
    const out = []

    for (const t of thermostats) {
      let response
      try {
        response = await this.client.getThermostatSensors(t.mac)
      } catch (err) {
        this.log.error(
          `[RoomSensor] discovery API call failed for thermostat ${t.nickname} (${t.mac}): ${err.message || err}`
        )
        if (err?.response?.data) {
          this.log.error(`[RoomSensor]   Earth response body: ${JSON.stringify(err.response.data)}`)
        }
        continue
      }

      // Log the raw response once per thermostat per startup. This is the
      // single most useful artifact when the API shape doesn't match our
      // expectations — without it we're guessing.
      if (!this._roomSensorRawLogged.has(t.mac)) {
        this._roomSensorRawLogged.add(t.mac)
        this.log.info(
          `[RoomSensor] First discovery response for thermostat "${t.nickname}" (${t.mac}). ` +
          `Save this if you're debugging:\n${JSON.stringify(response, null, 2)}`
        )
      }

      // Accept any of the response shapes we've seen across firmwares.
      // If yours isn't here, the raw log above will tell us what to add.
      let list = null
      let shapeUsed = null
      if (Array.isArray(response?.data?.sensor_list))     { list = response.data.sensor_list;     shapeUsed = 'data.sensor_list' }
      else if (Array.isArray(response?.data?.sub_device_list)) { list = response.data.sub_device_list; shapeUsed = 'data.sub_device_list' }
      else if (Array.isArray(response?.data?.sub_devices))     { list = response.data.sub_devices;     shapeUsed = 'data.sub_devices' }
      else if (Array.isArray(response?.data?.sub_device))      { list = response.data.sub_device;      shapeUsed = 'data.sub_device' }
      else if (Array.isArray(response?.data))                  { list = response.data;                 shapeUsed = 'data (array)' }
      else if (Array.isArray(response))                        { list = response;                       shapeUsed = '(array)' }
      else                                                     { list = [];                             shapeUsed = 'unknown — see raw log above' }

      if (this.config.pluginLoggingEnabled) {
        this.log(
          `[RoomSensor] Thermostat "${t.nickname}": parsed ${list.length} sensor(s) from response shape "${shapeUsed}"`
        )
      }
      if (list.length === 0 && response && this.config.pluginLoggingEnabled) {
        // We got something back but couldn't find a list — most likely a
        // shape we haven't catalogued. Log enough to add a new branch.
        this.log.warn?.(
          `[RoomSensor] Empty parse for "${t.nickname}". Top-level response keys: ${Object.keys(response || {}).join(', ') || '(none)'}; ` +
          `data keys: ${response?.data && typeof response.data === 'object' ? Object.keys(response.data).join(', ') : '(none)'}`
        )
      }

      for (const s of list) {
        const mac = s.device_id || s.device_mac || s.mac
        if (!mac) {
          this.log.warn?.(
            `[RoomSensor] Skipping sensor under "${t.nickname}" with no MAC. Entry keys: ${Object.keys(s || {}).join(', ')}`
          )
          continue
        }

        // The per-sensor properties may be nested or inline. Try the most
        // specific containers first; fall through to the entry itself.
        const props = s.props || s.device_params || s.device_info || s
        const iotState = props.iot_state ?? s.iot_state
        const conn_state = iotState === 'connect' || iotState === 1 ? 1 : 0

        const synthesized = {
          mac,
          nickname: s.name || s.nickname || `Room Sensor ${String(mac).slice(-4)}`,
          product_type: 'ThermostatRoomSensor',
          product_model: ThermostatRoomSensor.CO_TH1,
          firmware_ver: s.firmware_ver || t.firmware_ver,
          conn_state,
          parent_device_mac: t.mac,
          device_params: {
            temperature: props.temperature,
            humidity: props.humidity,
            battery: props.battery,
            rssi: props.rssi,
            iot_state: iotState,
          },
        }

        // Warn loudly if any of the four headline fields is missing — that's
        // a sign the Wyze schema differs from what we're assuming and the
        // tile will show a stale or default value.
        const missing = []
        if (synthesized.device_params.temperature == null) missing.push('temperature')
        if (synthesized.device_params.humidity == null) missing.push('humidity')
        if (synthesized.device_params.battery == null) missing.push('battery')
        if (synthesized.device_params.iot_state == null) missing.push('iot_state')
        if (missing.length > 0 && this.config.pluginLoggingEnabled) {
          this.log.warn?.(
            `[RoomSensor] "${synthesized.nickname}" (${mac}) missing fields [${missing.join(', ')}]. ` +
            `Sensor entry keys: ${Object.keys(s || {}).join(', ')}; ` +
            `props keys: ${props && typeof props === 'object' ? Object.keys(props).join(', ') : '(none)'}`
          )
        }

        out.push(synthesized)
      }
    }

    if (this.config.pluginLoggingEnabled) {
      this.log(`[RoomSensor] Discovered ${out.length} room sensor(s) across ${thermostats.length} thermostat(s)`)
    }
    return out
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
      // External (camera) accessories aren't registered with the bridge, so
      // they can't be unregistered here. They have to be removed manually
      // from the Home app — same behavior as homebridge-camera-ffmpeg /
      // homebridge-unifi-protect.
      const bridged = removedAccessories.filter(a => !(a instanceof WyzeCamera))
      if (bridged.length > 0) {
        if (this.config.pluginLoggingEnabled) this.log(`Removing ${bridged.length} device(s)`)
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, bridged.map(a => a.homeKitAccessory))
      }
    }

    this.accessories = foundAccessories
  }

  async loadDevice(device, timestamp) {
    const accessoryClass = this.getAccessoryClass(device.product_type, device.product_model, device.mac, device.nickname)
    if (!accessoryClass) {
      if (this.config.pluginLoggingEnabled) this.log(`[${device.product_type}] Unsupported device type: (Name: ${device.nickname}) (MAC: ${device.mac}) (Model: ${device.product_model})`)
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
      const isCamera = accessoryClass === WyzeCamera
      const homeKitAccessory = this.createHomeKitAccessory(
        device,
        isCamera ? Categories?.CAMERA : undefined,
        isCamera
      )
      accessory = new accessoryClass(this, homeKitAccessory)
      if (isCamera) {
        // Cameras are published as external accessories so they pair
        // independently from the bridge — sidesteps the ~150-accessory
        // bridge cap and gives much more reliable streaming. Each camera
        // shows up in HomeKit as its own device with its own setup code.
        this.api.publishExternalAccessories(PLUGIN_NAME, [homeKitAccessory])
      }
      this.accessories.push(accessory)
    } else {
      if (this.config.pluginLoggingEnabled) this.log(`[${device.product_type}] Loading accessory from cache ${device.nickname} (MAC: ${device.mac})`)
    }
    accessory.update(device, timestamp).catch((err) => {
      this.log.error(`[${device.product_type}] Unhandled error updating ${device.nickname}: ${err.message}\n${err.stack}`)
    })

    return accessory
  }

  getAccessoryClass(type, model) {
    const matches = (map) => map != null && Object.values(map).includes(model)
    switch (type) {
      case 'OutdoorPlug':
        if (matches(OutdoorPlugModels)) return WyzePlug
        break
      case 'Plug':
        if (matches(PlugModels)) return WyzePlug
        break
      case 'Light':
        if (matches(LightModels)) return WyzeLight
        break
      case 'MeshLight':
        if (matches(MeshLightModels)) return WyzeMeshLight
        break
      case 'LightStrip':
        if (matches(LightStripModels)) return WyzeMeshLight
        break
      case 'ContactSensor':
        if (matches(ContactSensorModels)) return WyzeContactSensor
        break
      case 'MotionSensor':
        if (matches(MotionSensorModels)) return WyzeMotionSensor
        break
      case 'Lock':
        if (matches(LockModels)) return WyzeLock
        break
      case 'TemperatureHumidity':
        if (matches(TemperatureHumidityModels)) return WyzeTemperatureHumidity
        break
      case 'ThermostatRoomSensor':
        if (matches(ThermostatRoomSensor)) return WyzeRoomSensor
        break
      case 'LeakSensor':
        if (matches(LeakSensorModels)) return WyzeLeakSensor
        break
      case 'Camera':
        if (matches(CameraModels)) return WyzeCamera
        break
      case 'Common':
        if (matches(LockBoltV2Models)) return WyzeLockBoltV2
        if (matches(CommonModels)) return WyzeSwitch
        break
      case 'S1Gateway':
        if (matches(S1GatewayModels)) return WyzeHMS
        break
      case 'Thermostat':
        if (matches(ThermostatModels)) return WyzeThermostat
        break
      // Wyze reports the vacuum's product_type as the model code itself
      // ("JA_RO2"), not "Vacuum" like every other accessory class.
      case VacuumModels.JA_RO2:
        if (matches(VacuumModels)) return WyzeVacuum
        break
      case 'Irrigation':
        if (matches(IrrigationModels)) return WyzeIrrigation
        break
    }
  }

  createHomeKitAccessory(device, category, external = false) {
    const uuid = UUIDGen.generate(device.mac)
    // Bound length and strip control chars so a malformed Wyze nickname
    // can't break HomeKit pairing or surprise the user.
    const safeName = sanitizeDeviceName(device.nickname)

    const homeKitAccessory = new Accessory(safeName, uuid, category)

    homeKitAccessory.context = {
      mac: device.mac,
      product_type: device.product_type,
      product_model: device.product_model,
      nickname: safeName
    }

    // External accessories (cameras) are published by the caller via
    // publishExternalAccessories so they don't go through the bridge.
    if (!external) {
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory])
    }
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
    if (accessoryClass === WyzeCamera) {
      // Cameras must be external accessories. If a camera shows up here it
      // was cached from an older plugin version that bridged it — drop the
      // bridged copy so loadDevice re-publishes it externally.
      try {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory])
        if (this.config.pluginLoggingEnabled) {
          this.log(`[Camera] Migrating ${homeKitAccessory.context.nickname} (${homeKitAccessory.context.mac}) from bridged to external — re-pair in Home app.`)
        }
      } catch (error) {
        // "Cannot find the bridged Accessory to remove" is benign on
        // subsequent restarts — the camera was already migrated to external
        // in a previous run.
        if (!String(error?.message || error).includes("Cannot find the bridged Accessory")) {
          this.log.error(`[Camera] Migration unregister failed for ${homeKitAccessory.context.nickname}: ${error}`)
        }
      }
      return
    }
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
