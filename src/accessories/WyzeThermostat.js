const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

// Already exist in temp sensor
const HOMEBRIDGE_THERMOSTAT_SERVICE = Service.Thermostat

const HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC = Characteristic.CurrentTemperature
const HOMEBRIDGE_CURRENTHEATINGCOOLINGSTATE_CHARACTERISTIC = Characteristic.CurrentHeatingCoolingState
const HOMEBRIDGE_TARGETHEATINGCOOLINGSTATE_CHARACTERISTIC = Characteristic.TargetHeatingCoolingState
const HOMEBRIDGE_TARGETTEMPERATURE_CHARACTERISTIC = Characteristic.TargetTemperature
const HOMEBRIDGE_COOLINGTHRESHOLDTEMPERATURE_CHARACTERISTIC = Characteristic.CoolingThresholdTemperature
const HOMEBRIDGE_HEATINGTHRESHOLDTEMPERATURE_CHARACTERISTIC = Characteristic.HeatingThresholdTemperature
const HOMEBRIDGE_TEMERPATUREDISPLAYUNITS_CHARACTERISTIC = Characteristic.TemperatureDisplayUnits

// want to add a temperature/humidity sensor to display how long it will take for system to complete current job - prop time2temp_val
// add temp humidity for real humidity as well
// add switch maybe to control fan mode - switch on is fan auto and switch off is fan off
// want to add temp sensors for all that are connected to thermostat as well 

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeThermostat extends WyzeAccessory {
    constructor (plugin, homeKitAccessory) {
      super(plugin, homeKitAccessory)
        // do setup code here

        
        this.setThermostatCallbacks()

        this.getTemperatureCharacteristic()
        this.getTargetTemperatureCharacteristic()
        this.getTargetHeatingCoolingStateCharacteristic()
        this.getCurrentHeatingCoolingStatCharacteristic()
        this.getCoolingThresholdTemperatureCharacteristic()
        this.getHeatingThresholdTemperatureCharacteristic()
        this.getTemperatureDisplayUnitsCharacteristic()
    }

    

    getThermostatService () {
        this.plugin.log.debug(`[Thermostat] Retrieving previous service for "${this.display_name}"`)
        let service = this.homeKitAccessory.getService(HOMEBRIDGE_THERMOSTAT_SERVICE)
    
        if (!service) {
          this.plugin.log.debug(`[Thermostat] Adding service for "${this.display_name}"`)
          service = this.homeKitAccessory.addService(HOMEBRIDGE_THERMOSTAT_SERVICE)
        }
    
        return service
    }

    setThermostatCallbacks() {
        this.getTargetTemperatureCharacteristic().onSet(this.setTargetTemperature.bind(this))
        this.getTargetHeatingCoolingStateCharacteristic().on('set', this.setTargetHeatingCoolingState.bind(this))
        this.getCoolingThresholdTemperatureCharacteristic().on('set', this.setCoolingThreshold.bind(this))
        this.getHeatingThresholdTemperatureCharacteristic().on('set', this.setHeatingThreshold.bind(this))
        this.getTemperatureDisplayUnitsCharacteristic().on('set', this.setTemperatureUnits.bind(this))
    }

    async setTargetTemperature(targetTemp) {
        // switch on current heating cooling state since we are NOT in auto mode
        switch(this.thermostatModeSys) {
            case this.Wyze2HomekitStates.auto:
                // do nothing since in auto
            case this.Wyze2HomekitStates.cool:
                this.setCoolPoint(targetTemp)
            case this.Wyze2HomekitStates.heat:
                this.setHeatPoint(targetTemp)
            case this.Wyze2HomekitStates.off:
                // do nothing
            default:
                // do nothing, some other issue if we get here
        }
    }

    async setTargetHeatingCoolingState(targetState) {
        let val = this.getKey(this.Wyze2HomekitStates, targetState)
        this.setHvacMode(val)
        this.getTargetHeatingCoolingStateCharacteristic().updateValue(targetState);
    }

    async setCoolingThreshold(coolingTemp) {
        this.setCoolPoint(this.c2f(coolingTemp))
        this.getCoolingThresholdTemperatureCharacteristic().updateValue(this.c2f(coolingTemp))
    }

    async setHeatingThreshold(heatingTemp) {
        let val = this.c2f(heatingTemp)
        this.setHeatPoint(val)
        this.getHeatingThresholdTemperatureCharacteristic().updateValue(val)
    }

    async setTemperatureUnits(tempUnits) {
        // nothing to do at the moment
    }


    getTemperatureCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching temperature status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC)
    }

    getCurrentHeatingCoolingStatCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching Current Heating Cooling State status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_CURRENTHEATINGCOOLINGSTATE_CHARACTERISTIC)
    }

    getTargetHeatingCoolingStateCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching Target Heating Cooling State status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_TARGETHEATINGCOOLINGSTATE_CHARACTERISTIC)
    }

    getTargetTemperatureCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching Target Temperature status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_TARGETTEMPERATURE_CHARACTERISTIC)
    }

    getCoolingThresholdTemperatureCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching Cooling Threshold status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_COOLINGTHRESHOLDTEMPERATURE_CHARACTERISTIC)
    }

    getHeatingThresholdTemperatureCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching Heating Threshold status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_HEATINGTHRESHOLDTEMPERATURE_CHARACTERISTIC)
    }

    getTemperatureDisplayUnitsCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching Temperature Display Units status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_TEMERPATUREDISPLAYUNITS_CHARACTERISTIC)
    }

    // this is where we do the magic
    async updateCharacteristics () {
        
        this.plugin.log.debug(`[Thermostat] Updating status of "${this.display_name}"`)

        // have to wait for this call to finish before updating or we might get null data
        this.thermostatGetIotProp().then(this.fillData.bind(this))
    }

    fillData() {
        this.getTemperatureCharacteristic().updateValue(this.f2c(this.thermostattemperature))

        // need to check heating/cooling mode to get correct target
        this.getTargetTemperatureCharacteristic(this.f2c(this.getTargetTemperatureForWorkingState(this.thermostatWorkingState)))

        // off, heat, cool, auto
        this.getTargetHeatingCoolingStateCharacteristic().updateValue(this.Wyze2HomekitStates[this.thermostatModeSys]);

        this.getCurrentHeatingCoolingStatCharacteristic().updateValue(this.Wyze2HomekitWorkingStates[this.thermostatWorkingState])
        this.getCoolingThresholdTemperatureCharacteristic().updateValue(this.f2c(this.thermostatCoolSetpoint))
        this.getHeatingThresholdTemperatureCharacteristic().updateValue(this.f2c(this.thermostatHeatSetpoint))
        this.getTemperatureDisplayUnitsCharacteristic().updateValue(this.Wyze2HomekitUnits[this.thermostatTempUnit])
        this.plugin.log.debug(`[Thermostat] Done updating status of "${this.display_name}"`)
    }

    getTargetTemperatureForWorkingState (device) {
        let s = this.Wyze2HomekitWorkingStates[this.thermostatWorkingState]

        if (s == this.Wyze2HomekitWorkingStates.cooling) {
            return this.f2c(this.thermostatCoolSetpoint)
        } else if (s == this.Wyze2HomekitWorkingStates.heating) {
            return this.f2c(this.thermostatHeatSetpoint)
        } else {
            return this.f2c(this.temperature)
        }
    }

    f2c(fahrenheit) {
        return (fahrenheit - 32.0) / 1.8
    }

    c2f(celsius) {
        return (celsius * 1.8) + 32.0
    }

    getKey(object, value) {
        return Object.keys(object)[value]
    }

    Wyze2HomekitUnits = {
        C: 0,
        F: 1
    }

    Wyze2HomekitStates = {
        off: 0,
        heat: 1,
        cool: 2,
        auto: 3
    }

    Wyze2HomekitWorkingStates = {
        idle: 0,
        heating: 1,
        cooling: 2
    }

    
}
  