const { Service,Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')
//A stateless programable switch is button that resets after pressing (think push button).
const SinglePressType = {
  CLASSIC: 1, // Classic Control
  IOT: 2, // Smart Control
}

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeSwitch extends WyzeAccessory {
  constructor (plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory)

    // create a new Switch service
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Switch] Retrieving previous service for "${this.display_name} (${this.mac})"`)
    this.wallSwitch = this.homeKitAccessory.getService(Service.Switch)
    
    if(!this.wallSwitch){ if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Switch] Adding service for "${this.display_name} (${this.mac})"`)
    this.wallSwitch = this.homeKitAccessory.addService(Service.Switch)}

    this.wallSwitch.getCharacteristic(Characteristic.On)
      .onGet(this.handleOnGetWallSwitch.bind(this))
      .onSet(this.handleOnSetWallSwitch.bind(this))
  }

  async updateCharacteristics (device) {
    if (device.conn_state === 0) {
      this.wallSwitch.getCharacteristic(Characteristic.On).updateValue(noResponse)
    } else {
      if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Switch] Updating status of "${this.display_name} (${this.mac})"`)
      const propertyList = await this.plugin.client.getIotProp(this.mac)
      for (const prop of Object.keys(propertyList.data.props)) {
        switch (prop) {
          case 'iot_state':
            this.iot_state = propertyList.data.props[prop]
            break
          case 'single_press_type':
            this.single_press_type = propertyList.data.props[prop]
            break
          case 'double_press_type':
            this.double_press_type = propertyList.data.props[prop]
          case 'triple_press_type':
            this.triple_press_type = propertyList.data.props[prop]
            break
          case 'long_press_type':
            this.long_press_type = propertyList.data.props[prop]
            break
          case 'switch-power':
            this.wallSwitch.getCharacteristic(Characteristic.On).updateValue(propertyList.data.props[prop])
            this.switch_power = propertyList.data.props[prop]
            break
          case 'switch-iot':
            this.switch_iot = propertyList.data.props[prop]
            break
        }
      }
    }
  }

  async handleOnGetWallSwitch() {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Switch] Getting Current State of "${this.display_name} (${this.mac})" : "${this.switch_power}"`)
    return this.switch_power
  }

  async handleOnSetWallSwitch(value) {
    if(this.plugin.config.logLevel == "debug") this.plugin.log(`[Switch] Target State Set "${this.display_name} (${this.mac})" : "${value}"`)
    if (this.single_press_type == SinglePressType.IOT){
      await this.plugin.client.wallSwitchIot(this.mac,this.product_model, (value) ? true : false)
    } else {
      await this.plugin.client.wallSwitchPower(this.mac,this.product_model, (value) ? true : false)
    }
  }
}
