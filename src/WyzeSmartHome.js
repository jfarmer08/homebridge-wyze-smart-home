const { homebridge, Accessory, UUIDGen } = require('./types');
const WyzeAPI = require('./WyzeAPI');
const WyzePlug = require('./accessories/WyzePlug');
const WyzeLight = require('./accessories/WyzeLight');
const WyzeMeshLight = require('./accessories/WyzeMeshLight');
const WyzeLock = require('./accessories/WyzeLock');
const WyzeContactSensor = require('./accessories/WyzeContactSensor');
const WyzeMotionSensor = require('./accessories/WyzeMotionSensor');
const WyzeTemperatureHumidity = require('./accessories/WyzeTemperatureHumidity')
const WyzeLeakSensor = require('./accessories/WyzeLeakSensor')

const PLUGIN_NAME = 'homebridge-wyze-smart-home';
const PLATFORM_NAME = 'WyzeSmartHome';

const DEFAULT_REFRESH_INTERVAL = 10000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = class WyzeSmartHome {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.client = this.getClient();

    this.accessories = [];

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  static register() {
    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, WyzeSmartHome);
  }

  getClient() {
    return new WyzeAPI({
      username: this.config.username,
      password: this.config.password,
      phoneId: this.config.phoneId,
      mfaCode: this.config.mfaCode,
    }, this.log);
  }

  didFinishLaunching() {
    this.runLoop();
  }

  async runLoop() {
    const interval = this.config.refreshInterval || DEFAULT_REFRESH_INTERVAL;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.refreshDevices();
      } catch (e) {}

      await delay(interval);
    }
  }

  async refreshDevices() {
    this.log.debug('Refreshing devices...');

    try {
      let objectList = await this.client.getObjectList();
      let timestamp = objectList.ts;
      let devices = objectList.data.device_list;

      this.log.debug(`Found ${devices.length} device(s)`);
      await this.loadDevices(devices, timestamp);
    } catch (e) {
      this.log.error(`Error getting devices: ${e}`);
      throw e;
    }
  }

  async loadDevices(devices, timestamp) {
    let foundAccessories = [];

    for (let device of devices) {
      let accessory = await this.loadDevice(device, timestamp);
      if (accessory) {
        foundAccessories.push(accessory);
      }
    }

    let removedAccessories = this.accessories.filter(a => !foundAccessories.includes(a));
    if (removedAccessories.length > 0) {
      this.log.info(`Removing ${removedAccessories.length} device(s)`);
      let removedHomeKitAccessories = removedAccessories.map(a => a.homeKitAccessory);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removedHomeKitAccessories);
    }

    this.accessories = foundAccessories;
  }

  async loadDevice(device, timestamp) {
    let accessoryClass = this.getAccessoryClass(device.product_type,device.product_model);
    if (!accessoryClass) {
      this.log.debug(`Unsupported device type: ${device.product_type}`);
      return;
    }

    let accessory = this.accessories.find(a => a.matches(device));
    if (!accessory) {
      this.log.info(`Setting up new device: ${device.nickname} (MAC: ${device.mac})`);
      let homeKitAccessory = this.createHomeKitAccessory(device);
      accessory = new accessoryClass(this, homeKitAccessory);
      this.accessories.push(accessory);
    }

    await accessory.update(device, timestamp);

    return accessory;
  }

  getAccessoryClass(type,model) {
    switch (type) {
      case 'OutdoorPlug':
        if (model == 'WLPPO') return;  // Discard entry for main unit. Only include the 2 electrical outlets.
      case 'Plug':
        return WyzePlug;
      case 'Light':
        return WyzeLight;
      case 'MeshLight':
      case 'LightStrip':   
        return WyzeMeshLight;
      case 'ContactSensor':
        return WyzeContactSensor;
      case 'MotionSensor':
        return WyzeMotionSensor;
      case 'Lock':
        return WyzeLock;
      case 'TemperatureHumidity':
        return WyzeTemperatureHumidity;
      case 'LeakSensor':
          return WyzeLeakSensor;
    }
  }

  createHomeKitAccessory(device) {
    let uuid = UUIDGen.generate(device.mac);
    let homeKitAccessory = new Accessory(device.nickname, uuid);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory]);
    return homeKitAccessory;
  }

  // Homebridge calls this method on boot to reinitialize previously-discovered devices
  configureAccessory(homeKitAccessory) {
    // Make sure we haven't set up this accessory already
    let accessory = this.accessories.find(a => a.homeKitAccessory === homeKitAccessory);
    if (accessory) {
      return;
    }

    let accessoryClass = this.getAccessoryClass(homeKitAccessory.context.product_type,homeKitAccessory.context.product_model);
    if (accessoryClass) {
      this.log.debug(`Configuring accessory: ${homeKitAccessory.displayName}`);
      accessory = new accessoryClass(this, homeKitAccessory);
      this.accessories.push(accessory);
    } else {
      this.log.debug(`Unrecognized accessory type "${homeKitAccessory.context.product_type}", removing: ${homeKitAccessory.displayName}`);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory]);
    }
  }
};
