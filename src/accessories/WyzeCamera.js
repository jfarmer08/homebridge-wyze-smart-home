const { Service, Characteristic, HapStatusError, HAPStatus } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
const enums = require('../enums')

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeCamera extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    if(Object.values(enums.CameraModels).includes(this.product_model)){
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [Privacy Switch] Retrieving previous service for "${this.display_name}"`)
      this.privacySwitch = this.homeKitAccessory.getService(this.display_name)
      
      if(!this.privacySwitch){ if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [Privacy Switch] Adding service for "${this.display_name}"`)
      this.privacySwitch = this.homeKitAccessory.addService(Service.Switch, this.display_name, 'Privacy')}
  
      this.privacySwitch.getCharacteristic(Characteristic.On)
        .onGet(this.handleOnGetPrivacySwitch.bind(this))
        .onSet(this.handleOnSetPrivacySwitch.bind(this))

      if (this.plugin.config.garageDoorAccessory?.find(d => d === this.mac)){
        this.garageDoorEnabled = true
        if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [Garage Door] Retrieving previous service for "${this.display_name}"`)
        this.garageDoorService = this.homeKitAccessory.getService(Service.GarageDoorOpener)
        if(!this.garageDoorService){ if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [Garage Door] Adding service for "${this.display_name}"`) 
        this.garageDoorService = this.homeKitAccessory.addService(Service.GarageDoorOpener)}
              // create handlers for required characteristics
        this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState)
        .onGet(this.getGarageCurrentState.bind(this));

        this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
          .onGet(this.getGarageTargetState.bind(this))
          .onSet(this.setGarageTargetState.bind(this))

        this.garageDoorService.getCharacteristic(Characteristic.ObstructionDetected)
          .onGet(this.handleObstructionDetectedGet.bind(this))
      }
      if (this.plugin.config.spotLightAccessory?.find(d => d === this.mac)){
        this.spotLightEnabled = true
        if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [Spotlight Switch] Retrieving previous service for "${this.display_name}"`)

        this.spotLightService = this.homeKitAccessory.getService(Service.Lightbulb)
        if(!this.spotLightService){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [Spotlight] Adding service for "${this.display_name}"`)
        this.spotLightService = this.homeKitAccessory.addService(Service.Lightbulb, this.display_name + ' Spotlight', 'Spotlight')}

        this.spotLightService.getCharacteristic(Characteristic.On)
        .onGet(this.handleOnGetSpotlight.bind(this))
        .onSet(this.handleOnSetSpotlight.bind(this))
      }
      if (this.plugin.config.floodLightAccessory?.find(d => d === this.mac)){
        this.floodLightEnabled = true
        if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [FloodLight] Retrieving previous service for "${this.display_name}"`)

        this.floodLightService = this.homeKitAccessory.getService(Service.Lightbulb)
        if(!this.floodLightService){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [FloodLight] Adding service for "${this.display_name}"`)
        this.floodLightService = this.homeKitAccessory.addService(Service.Lightbulb, this.display_name + ' FloodLight', 'FloodLight')}

        this.floodLightService.getCharacteristic(Characteristic.On)
        .onGet(this.handleOnGetFloodlight.bind(this))
        .onSet(this.handleOnSetFloodlight.bind(this))
      }
      if (this.plugin.config.sirenAccessory?.find(d => d === this.mac)){
        this.sirenEnabled = true
        if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] [Alarm Switch] Retrieving previous service for "${this.display_name}"`)
        this.alarmSwitch = this.homeKitAccessory.getService(this.display_name  + ' Siren')
        if(!this.alarmSwitch){if(this.plugin.config.logLevell == "debug") this.plugin.log(`[Camera] [Alarm Switch] Adding service for "${this.display_name}"`)
        this.alarmSwitch = this.homeKitAccessory.addService(Service.Switch, this.display_name + ' Siren', 'Siren')}
    
        this.alarmSwitch.getCharacteristic(Characteristic.On)
          .onGet(this.handleOnGetAlarmSwitch.bind(this))
          .onSet(this.handleOnSetAlarmSwitch.bind(this));
      }
    }
  }

  updateCharacteristics(device){
    if (device.conn_state === 0) {
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] Updating status "${this.display_name}" to noResponse`)
      this.privacySwitch.getCharacteristic(Characteristic.On).updateValue(noResponse)
      if (this.plugin.config.sirenAccessory?.find(d => d === device.mac)){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Siren] Updating status "${this.display_name}" to noResponse`) 
      this.alarmSwitch.getCharacteristic(Characteristic.On).updateValue(noResponse)}
      if (this.plugin.config.floodLightAccessory?.find(d => d === this.mac)){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera FloodLight] Updating status of "${this.display_name}" to noResponse`)
      this.floodLightService.getCharacteristic(Characteristic.On).updateValue(noResponse)}
      if (this.plugin.config.spotLightAccessory?.find(d => d === this.mac)){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera SpotLight] Updating status of "${this.display_name}" to noResponse`)
      this.spotLightService.getCharacteristic(Characteristic.On).updateValue(noResponse)}
      if (this.plugin.config.garageDoorAccessory?.find(d => d === this.mac)){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Garage Door] Updating status of "${this.display_name}"`)
      this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState).updateValue(noResponse)}
    } else { 
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera] Updating status of "${this.display_name}"`)
      this.handleOnGetPrivacySwitch()
      if(this.cameraAccessoryAttached()==true){this.getCameraPropertyList(device.mac, device.product_model)}
      if (this.plugin.config.sirenAccessory?.find(d => d === device.mac)){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Siren] Updating status of "${this.display_name}"`) 
      this.handleOnGetAlarmSwitch()}
      if (this.plugin.config.floodLightAccessory?.find(d => d === this.mac)){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera FloodLight] Updating status of "${this.display_name}"`)
      this.handleOnGetFloodlight()}
      if (this.plugin.config.spotLightAccessory?.find(d => d === this.mac)){if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera SpotLight] Updating status of "${this.display_name}"`)
      this.handleOnGetSpotlight()}
      if (this.plugin.config.garageDoorAccessory?.find(d => d === this.mac))
      {
        if(this.plugin.config.logLevel == "debug") { this.plugin.log(`[Camera Garage Door] Updating status of "${this.display_name}"`)}
      this.getGarageCurrentState()
      this.getGarageTargetState()

    }
    }
  }
   /**
   * Handle requests to get the current value of the "Current Door State" characteristic
   */
   async getGarageCurrentState() {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Garage Door] Getting Current Garage Door State for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)
    let currentValue

    if( this.homeKitAccessory.context.device_params.garageDoor == 1) {
       currentValue = Characteristic.CurrentDoorState.OPEN
    } else currentValue = Characteristic.CurrentDoorState.CLOSED
    return currentValue;
  }

  /**
   * Handle requests to get the current value of the "Target Door State" characteristic
   */
  async getGarageTargetState() {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Garage Door] Getting Target Garage Door State for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)

    let currentValue

    if( this.homeKitAccessory.context.device_params.garageDoor == 1) {
       currentValue = Characteristic.TargetDoorState.OPEN
    } else currentValue = Characteristic.TargetDoorState.CLOSED

    return currentValue;
  }

  /**
   * Handle requests to set the "Target Door State" characteristic
   */
  async setGarageTargetState(value) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Garage Door] Setting Target Garage Door State for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    this.plugin.client.garageDoor(this.mac,this.product_model)
    await this.sleep(1000)
    if(value == 0 ){
      this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState).updateValue(Characteristic.CurrentDoorState.OPEN)
    } else if(value == 1) {
      this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState).updateValue(Characteristic.CurrentDoorState.CLOSED)
    }
  }

  /**
   * Handle requests to get the current value of the "Obstruction Detected" characteristic
   */
  async handleObstructionDetectedGet() {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Garage Door] Getting ObstructionState Garage Door State for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)

    // set this to a valid value for ObstructionDetected
    const currentValue = 0

    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async handleOnGetPrivacySwitch() {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Privacy] Getting Privacy Switch for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)
    return this.homeKitAccessory.context.device_params.power_switch
  }

  async handleOnGetSpotlight() {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera SpotLight] Getting Spotlight for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)
    return this.homeKitAccessory.context.device_params.floodLight
  }

  async handleOnGetFloodlight() {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera FloodLight] Getting Floodlight for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)
    return this.homeKitAccessory.context.device_params.floodLight
  }

  async handleOnGetAlarmSwitch() {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Siren] Getting Alarm Switch for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname})`)
    // set this to a valid value for On
    return  this.homeKitAccessory.context.device_params.siren
  }

  async handleOnSetSpotlight(value) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera SpotLight] Setting Spotlight for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    this.plugin.client.cameraSpotLight(this.mac,this.product_model, (value) ? '1' : '2')
  }

  async handleOnSetFloodlight(value) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera SpotLight] Setting Floodlight for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    this.plugin.client.cameraFloodLight(this.mac,this.product_model, (value) ? '1' : '2')
  }

  async handleOnSetPrivacySwitch(value) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Privacy] Setting Privacy Switch for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    this.plugin.client.cameraPrivacy(this.mac,this.product_model, (value) ? 'power_on' : 'power_off')
  }

  async handleOnSetAlarmSwitch(value) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Camera Siren] Setting Alarm Switch for ${this.homeKitAccessory.context.mac} (${this.homeKitAccessory.context.nickname}) to ${value}`)
    this.plugin.client.cameraSiren(this.mac,this.product_model, (value) ? 'siren_on' : 'siren_off')
  }
}
