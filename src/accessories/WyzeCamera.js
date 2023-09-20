const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

const WYZE_API_POWER_PROPERTY = 'P3'

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeCamera extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    if(this.plugin.config.logging == "debug") this.plugin.log(`[Privacy Switch] Retrieving previous service for "${this.display_name}"`)
    this.privacySwitch = this.homeKitAccessory.getService(this.display_name)
    
    if(!this.privacySwitch){ if(this.plugin.config.logging == "debug") this.plugin.log(`[Privacy Switch] Adding service for "${this.display_name}"`)
     this.privacySwitch = this.homeKitAccessory.addService(Service.Switch, this.display_name, 'Privacy')}

    this.privacySwitch.getCharacteristic(Characteristic.On)
      .onGet(this.handleOnGetPrivacySwitch.bind(this))
      .onSet(this.handleOnSetPrivacySwitch.bind(this));

    if (this.plugin.config.garageDoorAccessory?.find(d => d === this.mac)){
      if(this.plugin.config.logging == "debug") this.plugin.log(`[Garage Door] Retrieving previous service for "${this.display_name}"`)
      this.garageDoorService = this.homeKitAccessory.getService(Service.GarageDoorOpener)
      if(!this.garageDoorService){ if(this.plugin.config.logging == "debug") this.plugin.log(`[Garage Door] Adding service for "${this.display_name}"`) 
      this.garageDoorService = this.homeKitAccessory.addService(Service.GarageDoorOpener)}
            // create handlers for required characteristics
      this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState)
      .onGet(this.handleCurrentDoorStateGet.bind(this));

      this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
        .onGet(this.handleTargetDoorStateGet.bind(this))
        .onSet(this.handleTargetDoorStateSet.bind(this));

      this.garageDoorService.getCharacteristic(Characteristic.ObstructionDetected)
        .onGet(this.handleObstructionDetectedGet.bind(this));
    }
    if (this.plugin.config.spotLightAccessory?.find(d => d === this.mac)){
      if(this.plugin.config.logging == "debug") this.plugin.log(`[Spotlight Switch] Retrieving previous service for "${this.display_name}"`)

      this.spotLightService = this.homeKitAccessory.getService(Service.Lightbulb)
      if(!this.spotLightService){if(this.plugin.config.logging == "debug") this.plugin.log(`[Spotlight] Adding service for "${this.display_name}"`)
       this.spotLightService = this.homeKitAccessory.addService(Service.Lightbulb, this.display_name + ' Spotlight', 'Spotlight')}

      //SpotLight
      // create handlers for required characteristics
      this.spotLightService.getCharacteristic(Characteristic.On)
      .onGet(this.handleOnGetSpotlight.bind(this))
      .onSet(this.handleOnSetSpotlight.bind(this));
    }

    if (this.plugin.config.alarmAccessory?.find(d => d === this.mac)){
      if(this.plugin.config.logging == "debug") this.plugin.log(`[Alarm Switch] Retrieving previous service for "${this.display_name}"`)
      this.alarmSwitch = this.homeKitAccessory.getService(this.display_name  + ' Siren')
      if(!this.alarmSwitch){if(this.plugin.config.logging == "debug") this.plugin.log(`[Alarm Switch] Adding service for "${this.display_name}"`)
       this.alarmSwitch = this.homeKitAccessory.addService(Service.Switch, this.display_name + ' Siren', 'Siren')}
  
      this.alarmSwitch.getCharacteristic(Characteristic.On)
        .onGet(this.handleOnGetAlarmSwitch.bind(this))
        .onSet(this.handleOnSetAlarmSwitch.bind(this));
    }

    //this.getCameraPropertyList()
  }

   /**
   * Handle requests to get the current value of the "Current Door State" characteristic
   */
   handleCurrentDoorStateGet(value) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Getting Current Garage Door State for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    let currentValue

    if( this.homeKitAccessory.context.device_params.garageDoor == 1) {
       currentValue = Characteristic.CurrentDoorState.OPEN
    } else currentValue = Characteristic.CurrentDoorState.CLOSED

    return currentValue;
  }


  /**
   * Handle requests to get the current value of the "Target Door State" characteristic
   */
  handleTargetDoorStateGet(value) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Getting Target Garage Door State for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    
    let currentValue
    if( this.homeKitAccessory.context.device_params.garageDoor == 1) {
      currentValue = Characteristic.TargetDoorState.CLOSED
    } else currentValue = Characteristic.TargetDoorState.OPEN

    return currentValue;
  }

  /**
   * Handle requests to set the "Target Door State" characteristic
   */
  handleTargetDoorStateSet(value) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Setting Target Garage Door State for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    this.plugin.client.garageDoor(this.mac,this.product_model)
  }

  /**
   * Handle requests to get the current value of the "Obstruction Detected" characteristic
   */
  handleObstructionDetectedGet() {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Getting ObstructionState Garage Door State for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)

    // set this to a valid value for ObstructionDetected
    const currentValue = 0

    return currentValue;
  }

  handleOnGetSpotlight() {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Getting Spotlight for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)
    console.log('Floodlight ' +this.homeKitAccessory.context.device_params.floodLight)
    // set this to a valid value for On

    if (this.homeKitAccessory.context.device_params.floodLight == 1 || this.homeKitAccessory.context.device_params.floodLight === 'undefined'){
      return 1
    } else return 0;
  }

  handleOnSetSpotlight(value) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Setting Spotlight for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    if (value === true) {
      this.plugin.client.cameraFloodLightOn(this.mac,this.product_model)
    } else this.plugin.client.cameraFloodLightOff(this.mac,this.product_model)
  }

  handleOnGetPrivacySwitch() {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Getting Privacy Switch for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)

    return this.homeKitAccessory.context.device_params.power_switch
  }

  handleOnSetPrivacySwitch(value) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Setting Privacy Switch for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    if (value === true) {
      this.plugin.client.cameraTurnOn(this.mac,this.product_model)
    } else this.plugin.client.cameraTurnOff(this.mac,this.product_model)
  }

  handleOnGetAlarmSwitch() {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Getting Alarm Switch for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)
    console.log('Floodlight ' +this.homeKitAccessory.context.device_params.siren)

    let currentValue
    if(this.homeKitAccessory.context.device_params.siren === 'undefined') {
       currentValue = 0
    } else currentValue = this.homeKitAccessory.context.device_params.siren
    // set this to a valid value for On
    return currentValue
  }

  handleOnSetAlarmSwitch(value) {
    if(this.plugin.config.logging == "debug") this.plugin.log(`Setting Alarm Switch for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    if (value === true) {
      this.plugin.client.cameraSirenOn(this.mac,this.product_model)
    } else this.plugin.client.cameraSirenOff(this.mac,this.product_model)
  }
}
