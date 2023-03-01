const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

// want to add a temperature/humidity sensor to display how long it will take for system to complete current job - prop time2temp_val
// add temp humidity for real humidity as well
// add switch maybe to control fan mode - switch on is fan auto and switch off is fan off
// want to add temp sensors for all that are connected to thermostat as well 

const noResponse = new Error('No Response')
noResponse.toString = () => { return noResponse.message }

module.exports = class WyzeThermostat extends WyzeAccessory {
    constructor (plugin, homeKitAccessory) {
        super(plugin, homeKitAccessory)

        // set accessory information
        this.homeKitAccessory.getService(Service.Thermostat.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, 'Wyze')
            .setCharacteristic(Characteristic.Model, 'Thermostat')
            .setCharacteristic(Characteristic.SerialNumber, 'WYZE-THERMOSTAT');


        this.service = this.getThermostatService()

        // GET current heat/cool/off state
        this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this));

        // GET current temperature
        this.service.getCharacteristic(Characteristic.CurrentTemperature)
            .onGet(this.handleCurrentTemperatureGet.bind(this));

        // Target heat/cool/off state
        this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
            .onSet(this.handleTargetHeatingCoolingStateSet.bind(this));

        // Target temperature handlers - needed given that the system is not in auto
        this.service.getCharacteristic(Characteristic.TargetTemperature)
            .onGet(this.handleTargetTemperatureGet.bind(this))
            .onSet(this.handleTargetTemperatureSet.bind(this));

        // Cooling setpoint handlers - needed for system in Auto
        this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .onGet(this.handleCoolingThresholdTemperatureGet.bind(this))
            .onSet(this.handleCoolingThresholdTemperatureSet.bind(this));

        // Heating setpoint handlers - needed for system in Auto
        this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
            .onSet(this.handleHeatingThresholdTemperatureSet.bind(this));

        // Target display unit handlers
        this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
            .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));

        this.updateCharacteristics();
    }

    setDefaultValues() {
        this.thermostatTemperature = 69.0
        this.thermostatCoolSetpoint = 65.0
        this.thermostatHeatSetpoint = 72.0
        this.thermostatModeSys = "auto"
        this.thermostatWorkingState = "idle"
        this.thermostatTempUnit = "F"
    }

    // GET Methods for returning device data to homekit when homekit asks for example when loading the home app for the first time

    async handleCurrentTemperatureGet() {
        this.plugin.log.debug(`[Thermostat] Getting targetTemperature status of "${this.display_name}" to ${this.thermostatTemperature}`)

        return this.f2c(this.thermostatTemperature)
    }
    async handleCurrentHeatingCoolingStateGet() {
        return this.Wyze2HomekitWorkingStates[this.thermostatWorkingState]
    }
    async handleTargetHeatingCoolingStateGet() {
        return this.Wyze2HomekitStates[this.thermostatModeSys]
    }
    async handleTargetTemperatureGet() {
        this.plugin.log.debug("Thermostat Target Temp: " + this.c2f(this.getTargetTemperatureForSystemState()))
        return this.getTargetTemperatureForSystemState()
    }
    async handleCoolingThresholdTemperatureGet() {
        this.plugin.log.debug("Thermostat Cool Setpoint: " + (this.thermostatCoolSetpoint))

        return this.f2c(this.thermostatCoolSetpoint)
    }
    async handleHeatingThresholdTemperatureGet() {
        this.plugin.log.debug("Thermostat Heat Setpoint: " + (this.thermostatHeatSetpoint))

        return this.f2c(this.thermostatHeatSetpoint)
    }
    async handleTemperatureDisplayUnitsGet() {
        return this.Wyze2HomekitUnits[this.thermostatTempUnit]
    }

    // SET Methods for taking data from homekit and applying it to Wyze thermostat
    async handleTargetHeatingCoolingStateSet(value) {
        let targetState = this.getKey(this.Wyze2HomekitStates, value)
        this.plugin.log.debug(`[Thermostat] Setting targetHeatingCoolingState status of "${this.display_name}" to ${targetState} (${value})`)

        this.setHvacMode(targetState)
        this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(value);
        this.thermostatModeSys = targetState
    }
    async handleTargetTemperatureSet(value) {
        let targetTemp = this.c2f(value)
        this.plugin.log.debug(`[Thermostat] Setting targetTemperature status of "${this.display_name}" to ${targetTemp}`)

        // switch on current heating cooling state since we are NOT in auto mode
        switch(this.thermostatModeSys) {
            case this.Wyze2HomekitStates.auto:
                // do nothing since in auto
            case this.Wyze2HomekitStates.cool:
                this.setCoolPoint(targetTemp)
                this.thermostatCoolSetpoint = targetTemp
            case this.Wyze2HomekitStates.heat:
                this.setHeatPoint(targetTemp)
                this.thermostatHeatSetpoint = targetTemp
            case this.Wyze2HomekitStates.off:
                // do nothing
            default:
                // do nothing, some other issue if we get here
        }
        this.service.getCharacteristic(Characteristic.TargetTemperature).updateValue(value)
    }
    async handleCoolingThresholdTemperatureSet(value) {
        let val = Math.round(this.c2f(value))

        this.plugin.log.debug(`[Thermostat] Setting setCoolingThreshold status of "${this.display_name}" to ${val}`)

        this.setCoolPoint(val)
        this.thermostatCoolSetpoint = val
        this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(value)
    }
    async handleHeatingThresholdTemperatureSet(value) {
        let val = Math.round(this.c2f(value))

        this.plugin.log.debug(`[Thermostat] Setting setHeatingThreshold status of "${this.display_name}" to ${val}`)

        this.setHeatPoint(val)
        this.thermostatHeatSetpoint = val
        this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(value)
    }
    async handleTemperatureDisplayUnitsSet(value) {
        // nothing for now, can use internally maybe
        this.plugin.log.debug(`[Thermostat] Setting temperatureDisplayUnits status of "${this.display_name}" to ${value}`)
        this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits).updateValue(value)
    }


    // this is where we do the magic
    async updateCharacteristics () {
        
        this.plugin.log.debug(`[Thermostat] Updating status of "${this.display_name}"`)

        // have to wait for this call to finish before updating or we might get null data
        this.thermostatGetIotProp().then(this.fillData.bind(this))
    }

    fillData() {
        this.plugin.log.debug("Thermostat Temp: " + (this.thermostatTemperature))

        this.plugin.log.debug("Thermostat Target Temp: " + this.c2f(this.getTargetTemperatureForSystemState()))
        
        this.plugin.log.debug("Thermostat Mode Sys: " + this.thermostatModeSys + " for " + this.Wyze2HomekitStates[this.thermostatModeSys])

        this.plugin.log.debug("Thermostat Working State: " + this.thermostatWorkingState + " for " + this.Wyze2HomekitWorkingStates[this.thermostatWorkingState])

        this.plugin.log.debug("Thermostat Cool Setpoint: " + (this.thermostatCoolSetpoint))

        this.plugin.log.debug("Thermostat Heat Setpoint: " + (this.thermostatHeatSetpoint))

        this.plugin.log.debug("Thermostat Temp Units: " + this.Wyze2HomekitUnits[this.thermostatTempUnit])
    }

    getTargetTemperatureForSystemState() {
        // relies on temperature setpoints to tell Homekit what the system is currently doing
        // Wyze seems to not actually send the "working state" to user at the moment so we have to decide what the system is doing manually

        let s = this.Wyze2HomekitStates[this.thermostatModeSys]
        if (s == this.Wyze2HomekitStates.cool) {
            return this.f2c(this.thermostatCoolSetpoint)
        } else if (s == this.Wyze2HomekitStates.heat) {
            return this.f2c(this.thermostatHeatSetpoint)
        } else if (s == this.Wyze2HomekitStates.auto) {
            if (this.thermostatCoolSetpoint < this.thermostatTemperature) {
                return this.f2c(this.thermostatCoolSetpoint)
            } else if (this.thermostatHeatSetpoint > this.thermostatTemperature) {
                return this.f2c(this.thermostatHeatSetpoint)
            } else {
                return this.f2c(this.thermostatTemperature)
            }
        } else {
            return this.f2c(this.thermostatTemperature)
        }
    }

    getThermostatService() {
        this.plugin.log.debug(`[Thermostat] Retrieving previous service for "${this.display_name}"`)
        let service = this.homeKitAccessory.getService(Service.Thermostat)
    
        if (!service) {
          this.plugin.log.debug(`[Thermostat] Adding service for "${this.display_name}"`)
          service = this.homeKitAccessory.addService(Service.Thermostat)
        }
    
        return service
    }

    f2c(fahrenheit) {
        return ((fahrenheit) - 32.0) / 1.8
      }

    c2f(celsius) {
        return ((celsius) * 1.8) + 32.0
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
  
