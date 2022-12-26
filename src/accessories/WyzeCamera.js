const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const WYZE_API_POWER_PROPERTY = 'P3'
const cameraProperty = {  
  NOTIFICATION : "P1",
  ON : "P3",
  AVAILABLE : "P5",
  CAMERA_SIREN : "P1049",
  FLOOD_LIGHT : "P1056",
}

module.exports = class WyzeCamera extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    
    // create a new Switch service
    let powerService = this.homeKitAccessory.getService('Power') ||
      this.homeKitAccessory.addService(Service.Switch,'Power', '0026BB765291-Power')
      powerService.subtype = 'Power'

    // create handlers for required characteristics
    powerService.getCharacteristic(Characteristic.On)
      .onGet(this.handlePowerOnGet.bind(this))
      .onSet(this.handlePowerOnSet.bind(this))

    let sirenService = this.homeKitAccessory.getService('Siren') ||
      this.homeKitAccessory.addService(Service.Switch,'Siren', '0026BB765292-Siren')
      sirenService.subtype = 'Siren'

    // create handlers for required characteristics
    sirenService.getCharacteristic(Characteristic.On)
      .onGet(this.handleSirenOnGet.bind(this))
      .onSet(this.handleSirenOnSet.bind(this))

    //let floodLightService = this.homeKitAccessory.getService('Flood Light') ||
     // this.homeKitAccessory.addService(Service.Switch, 'Flood Light', '0026BB765292-FloodLight')
   //floodLightService.subtype = 'FloodLight'

    this.getCameraPropertyList()
//////////////
    //new Service(displayName?: string, UUID: string, subtype?: string):

      ///var accessory = new homeKitAccessory(name, uuid, 10);

    //  self.log("Adding Reset Switch:");
 //     accessory.reachable = true;
//      accessory.context.name = name;
      //        accessory.context.model = model;
      //        accessory.context.url = url;
  
//      accessory.addService(Service.Switch, name)
 //       .getCharacteristic(Characteristic.On)
 //       .on('set', self.resetDevices.bind(self, accessory));
  ////////////////
}


   /**
   * Handle requests to get the current value of the "On" characteristic
   */
    handlePowerOnGet() {
      this.plugin.log.debug(`[Camera] Fetching Power status of "${this.display_name}"`)
  
      return this.cameraOn;
    }

    handleSirenOnGet() {
      this.plugin.log.debug(`[Camera] Fetching Siren status of "${this.display_name}"`)
  
      return this.cameraSiren;
    }
  
    /**
     * Handle requests to set the "On" characteristic
     */
    async handlePowerOnSet(value) {
      this.plugin.log.debug(`Setting power for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) Power to ${value}`)
      try {
        if (value === true) {
          await this.cameraTurnOn()
        } else {
          await this.cameraTurnOff()        }
  
      } catch (e) {
        console.log(e)
      }
    }

        /**
     * Handle requests to set the "On" characteristic
     */
      async handleSirenOnSet(value) {
      this.plugin.log.debug(`Setting power for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) Siren`)
      try {
        if (value === true) {
          await this.cameraSirenOn()
        } else {
          await this.cameraSirenOff()
        }
  
      } catch (e) {
        console.log(e)
      }
    }
}
