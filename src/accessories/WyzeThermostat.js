const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

// want to add a temperature/humidity sensor to display how long it will take for system to complete current job - prop time2temp_val
// add temp humidity for real humidity as well
// add switch maybe to control fan mode - switch on is fan auto and switch off is fan off
// want to add temp sensors for all that are connected to thermostat as well

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class WyzeThermostat extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.service = this.getThermostatService();

    // GET current heat/cool/off state
    this.service
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this));

    // GET current temperature
    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    // Target heat/cool/off state
    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
      .onSet(this.handleTargetHeatingCoolingStateSet.bind(this));

    // Target temperature handlers - needed given that the system is not in auto
    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .onGet(this.handleTargetTemperatureGet.bind(this))
      .onSet(this.handleTargetTemperatureSet.bind(this));

    // Cooling setpoint handlers - needed for system in Auto
    this.service
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .onGet(this.handleCoolingThresholdTemperatureGet.bind(this))
      .onSet(this.handleCoolingThresholdTemperatureSet.bind(this))

    // Heating setpoint handlers - needed for system in Auto
    // Default max value is 25, but we set it higher here for Wyze thermostats
    // Shoutout to @fennix for the idea here: 
    // https://github.com/tomas-kulhanek/homebridge-fenix-v24-wifi/blob/30a016ea125a5cfd439106472c1afd11f0ad6a2f/src/platformAccessory.ts#L65
    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
      .onSet(this.handleHeatingThresholdTemperatureSet.bind(this))
      .setProps({
        maxValue: 35
      });

    // Target display unit handlers
    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
      .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));

    this.updateCharacteristics();
  }

  async handleCurrentTemperatureGet() {
    this.debugLog("handleCurrentTemperatureGet status of " + this.display_name + " to " + this.thermostatTemperature);

    return this.f2c(this.thermostatTemperature);
  }

  async handleCurrentHeatingCoolingStateGet() {
    return this.Wyze2HomekitWorkingStates[this.thermostatWorkingState];
  }

  async handleTargetHeatingCoolingStateGet() {
    return this.Wyze2HomekitStates[this.thermostatModeSys];
  }

  async handleTargetTemperatureGet() {
    this.debugLog("handleTargetTemperatureGet Target Temp: " + this.c2f(this.getTargetTemperatureForSystemState()));

    return this.getTargetTemperatureForSystemState();
  }

  async handleCoolingThresholdTemperatureGet() {
    this.debugLog("handleCoolingThresholdTemperatureGet Cool Setpoint: " + this.thermostatCoolSetpoint);

    return this.f2c(this.thermostatCoolSetpoint);
  }

  async handleHeatingThresholdTemperatureGet() {
    this.debugLog("handleHeatingThresholdTemperatureGet Heat Setpoint: " + this.thermostatHeatSetpoint);

    return this.f2c(this.thermostatHeatSetpoint);
  }

  async handleTemperatureDisplayUnitsGet() {
    return this.Wyze2HomekitUnits[this.thermostatTempUnit];
  }

  // SET Methods for taking data from homekit and applying it to Wyze thermostat
  async handleTargetHeatingCoolingStateSet(value) {
    let targetState = this.getKey(this.Wyze2HomekitStates, value);
    this.debugLog("handleTargetHeatingCoolingStateSet status of " + this.display_name + " to " + targetState);

    this.setHvacMode(targetState);
    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .updateValue(value);
    this.thermostatModeSys = targetState;

    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .updateValue(this.getTargetTemperatureForSystemState());
  }

  async handleTargetTemperatureSet(value) {
    let targetTemp = this.c2f(value);
    let currentStateNumber = this.Wyze2HomekitStates[this.thermostatModeSys];
    this.debugLog("handleTargetTemperatureSet status of " + this.display_name + " to " + targetTemp + " for mode " + this.thermostatModeSys + " which is " + currentStateNumber);

    // switch on current heating cooling state since we are NOT in auto mode
    switch (currentStateNumber) {
      case this.Wyze2HomekitStates.auto:
        this.debugLog("handleTargetTemperatureSet cannot set value since system is in AUTO");
        break;
      case this.Wyze2HomekitStates.cool:
        this.debugLog("handleTargetTemperatureSet for COOLING");
        this.handleCoolingThresholdTemperatureSet(value);
        break;
      case this.Wyze2HomekitStates.heat:
        this.debugLog("handleTargetTemperatureSet for HEATING");
        this.handleHeatingThresholdTemperatureSet(value);
        break;
      case this.Wyze2HomekitStates.off:
        this.debugLog("handleTargetTemperatureSet cannot set value since system is OFF");
        break;
      default:
        this.debugLog("handleTargetTemperatureSet cannot set value since system mode is UNDEFINED");
        break;
    }

    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .updateValue(value);
  }

  async handleCoolingThresholdTemperatureSet(value) {
    let c = this.clamp(value, 10, 35);
    let val = Math.round(this.c2f(c));
    this.debugLog("handleCoolingThresholdTemperatureSet status of " + this.display_name + " to " + val);

    this.setCoolPoint(val);
    this.thermostatCoolSetpoint = val;
    this.service
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .updateValue(c);
  }

  async handleHeatingThresholdTemperatureSet(value) {
    let c = this.clamp(value, 0, 25);
    let val = Math.round(this.c2f(c));
    this.debugLog("handleHeatingThresholdTemperatureSet status of " + this.display_name + " to " + val);

    this.setHeatPoint(val);
    this.thermostatHeatSetpoint = val;
    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .updateValue(c);
  }

  async handleTemperatureDisplayUnitsSet(value) {
    this.debugLog("handleTemperatureDisplayUnitsSet status of " + this.display_name + " to " + value);
    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .updateValue(value);
  }

  // this is where we do the magic
  async updateCharacteristics(device) {
    this.debugLog("Updating status of " + this.display_name);

    // have to wait for this call to finish before updating or we might get null data
    this.thermostatGetIotProp().then(this.fillData.bind(this));
  }

  fillData() {
    // This just prints new data from Wyze API
    this.debugLog("Temp: " + this.thermostatTemperature);
    this.debugLog("Target Temp: " + this.c2f(this.getTargetTemperatureForSystemState()));
    this.debugLog("Mode Sys: " + this.thermostatModeSys + " for " + this.Wyze2HomekitStates[this.thermostatModeSys]);
    this.debugLog("Working State: " + this.thermostatWorkingState + " for " + this.Wyze2HomekitWorkingStates[this.thermostatWorkingState]);
    this.debugLog("Cool Setpoint: " + this.thermostatCoolSetpoint);
    this.debugLog("Heat Setpoint: " + this.thermostatHeatSetpoint);
    this.debugLog("Temp Units: " + this.Wyze2HomekitUnits[this.thermostatTempUnit]);
  }

  getTargetTemperatureForSystemState() {
    // relies on temperature setpoints to tell Homekit what the system is currently doing
    // Wyze seems to not actually send the "working state" to user at the moment so we have to decide what the system is doing manually

    let s = this.Wyze2HomekitStates[this.thermostatModeSys];
    if (s == this.Wyze2HomekitStates.cool) {
      return this.f2c(this.thermostatCoolSetpoint);
    } else if (s == this.Wyze2HomekitStates.heat) {
      return this.f2c(this.thermostatHeatSetpoint);
    } else if (s == this.Wyze2HomekitStates.auto) {
      if (this.thermostatCoolSetpoint < this.thermostatTemperature) {
        return this.f2c(this.thermostatCoolSetpoint);
      } else if (this.thermostatHeatSetpoint > this.thermostatTemperature) {
        return this.f2c(this.thermostatHeatSetpoint);
      } else {
        return this.f2c(this.thermostatTemperature);
      }
    } else {
      return this.f2c(this.thermostatTemperature);
    }
  }

  getThermostatService() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[Thermostat] Retrieving previous service for "${this.display_name}"`
      );
    let service = this.homeKitAccessory.getService(Service.Thermostat);

    if (!service) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[Thermostat] Adding service for "${this.display_name}"`
        );
      service = this.homeKitAccessory.addService(Service.Thermostat);
    }

    return service;
  }

  debugLog(message) {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        this.colors.CYAN + "[Thermostat] " + message + this.colors.RESET
      );
  }

  f2c(fahrenheit) {
    let out = (fahrenheit - 32.0) / 1.8;
    return out;
  }

  c2f(celsius) {
    return celsius * 1.8 + 32.0;
  }

  getKey(object, value) {
    return Object.keys(object)[value];
  }

  Wyze2HomekitUnits = {
    C: 0,
    F: 1,
  };

  Wyze2HomekitStates = {
    off: 0,
    heat: 1,
    cool: 2,
    auto: 3,
  };

  Wyze2HomekitWorkingStates = {
    idle: 0,
    heating: 1,
    cooling: 2,
  };

  HomekitTargetTempValues = {
    max: 38,
    min: 10,
    step: 0.1
  }

  HomekitHeatingThresholdValues = {
    max: 25,
    min: 0,
    step: 0.1
  }

  HomekitCoolingThresholdValues = {
    max: 35,
    min: 10,
    step: 0.1
  }

  clamp(number, min, max) {
    if (number < min) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[Thermostat] Clamping value: ${number} to min ${min}`
        );
    }

    if (number > max) {
      if (this.plugin.config.logLevel == "debug")
        this.plugin.log.info(
          `[Thermostat] Clamping value: ${number} to max ${max}`
        );
    }

    return Math.max(min, Math.min(number, max));
  }

  colors = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    UNDERSCORE: '\x1b[4m',
    BLINK: '\x1b[5m',
    REVERSE: '\x1b[7m',
    HIDDEN: '\x1b[8m',
    BLACK: '\x1b[30m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    LIGHT_GREY: '\x1b[37m',
    GREY: '\x1b[90m',
    WHITE: '\x1b[97m'
  };
};
