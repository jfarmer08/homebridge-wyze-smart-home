const { Service, Characteristic } = require('../types')
const WyzeAccessory = require('./WyzeAccessory')

// Already exist in temp sensor
// const HOMEBRIDGE_TEMPERATURE_SERVICE = Service.TemperatureSensor
// const HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC = Characteristic.CurrentTemperature

const HOMEBRIDGE_THERMOSTAT_SERVICE = Service.Thermostat

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
  

        this.thermostatGetIotProp()
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
        this.getTargetTemperatureCharacteristic.onSet(this.setTargetTemperature.bind(this))
        this.getTargetHeatingCoolingStateCharacteristic.onSet(this.setTargetHeatingCoolingState.bind(this))
        this.getCoolingThresholdTemperatureCharacteristic.onSet(this.setCoolingThreshold.bind(this))
        this.getHeatingThresholdTemperatureCharacteristic.onSet(this.setHeatingThreshold.bind(this))
        this.getTemperatureDisplayUnitsCharacteristic.onSet(this.setTemperatureUnits.bind(this))
    }

    async setTargetTemperature(targetTemp) {
        // switch on current heating cooling state since we are NOT in auto mode
    }

    async setTargetHeatingCoolingState(targetState) {
        this.setHvacMode(Wyze2HomekitStates[targetState])
    }

    async setCoolingThreshold(coolingTemp) {

    }

    async setHeatingThreshold(heatingTemp) {

    }

    async setTemperatureUnits(tempUnits) {
        
    }


    getTemperatureCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_TEMPERATURE_CHARACTERISTIC)
    }

    getCurrentHeatingCoolingStatCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_CURRENTHEATINGCOOLINGSTATE_CHARACTERISTIC)
    }

    getTargetHeatingCoolingStateCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_TARGETHEATINGCOOLINGSTATE_CHARACTERISTIC)
    }

    getTargetTemperatureCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_TARGETTEMPERATURE_CHARACTERISTIC)
    }

    getCoolingThresholdTemperatureCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_COOLINGTHRESHOLDTEMPERATURE_CHARACTERISTIC)
    }

    getHeatingThresholdTemperatureCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_HEATINGTHRESHOLDTEMPERATURE_CHARACTERISTIC)
    }

    getTemperatureDisplayUnitsCharacteristic () {
        this.plugin.log.debug(`[Thermostat] Fetching status of "${this.display_name}"`)
        return this.getThermostatService().getCharacteristic(HOMEBRIDGE_TEMERPATUREDISPLAYUNITS_CHARACTERISTIC)
    }

    // this is where we do the magic
    updateCharacteristics (device) {
        this.plugin.log.debug(`[Thermostat] Updating status of "${this.display_name}"`)
        this.getTemperatureCharacteristic().updateValue(this.f2c(device.device_params.temperature))

        // need to check heating/cooling mode to get correct target
        this.getTargetTemperatureCharacteristic(this.f2c(this.getTargetTemperatureForWorkingState(device.device_params.working_state)))

        // off, heat, cool, auto
        this.getTargetHeatingCoolingStateCharacteristic().updateValue(Wyze2HomekitStates[device.device_params.mode_sys]);

        this.getCurrentHeatingCoolingStatCharacteristic().updateValue(Wyze2HomekitWorkingStates[device.device_params.working_state])
        this.getCoolingThresholdTemperatureCharacteristic().updateValue(this.f2c(device.device_params.cool_sp))
        this.getHeatingThresholdTemperatureCharacteristic().updateValue(this.f2c(device.device_params.heat_sp))
        this.getTemperatureDisplayUnitsCharacteristic().updateValue(this.Wyze2HomekitUnits[device.device_params.temp_unit])
    }

    getTargetTemperatureForWorkingState (device) {
        let s = Wyze2HomekitWorkingStates[device.device_params.working_state]

        if (s == this.Wyze2HomekitWorkingStates.cooling) {
            return this.f2c(device.device_params.cool_sp)
        } else if (s == this.Wyze2HomekitWorkingStates.heating) {
            return this.f2c(device.device_params.heat_sp)
        } else {
            return this.f2c(device.device_params.temperature)
        }
    }

    //Thermostat: Can we move this to its own class - thermostat
    async thermostatSetIotProp(deviceMac, prop, value) {
        const response = await this.plugin.client.setIotProp(deviceMac, prop, value)
        return response
    }
    
    async thermostatGetIotProp() {
        // Might need to copy wallSwitchGetIotProp = and store context
        const keys = 'trigger_off_val,emheat,temperature,humidity,time2temp_val,protect_time,mode_sys,heat_sp,cool_sp, current_scenario,config_scenario,temp_unit,fan_mode,iot_state,w_city_id,w_lat,w_lon,working_state, dev_hold,dev_holdtime,asw_hold,app_version,setup_state,wiring_logic_id,save_comfort_balance, kid_lock,calibrate_humidity,calibrate_temperature,fancirc_time,query_schedule'
        const response = await this.plugin.client.getIotProp(this.mac, keys)
        return response
    }

    f2c(fahrenheit) {
        return (fahrenheit - 32.0) / 1.8
    }

    c2f(celsius) {
        return (celsius * 1.8) + 32.0
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
  