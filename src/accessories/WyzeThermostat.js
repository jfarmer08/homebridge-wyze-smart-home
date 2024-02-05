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
      .onSet(this.handleCoolingThresholdTemperatureSet.bind(this));

    // Heating setpoint handlers - needed for system in Auto
    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
      .onSet(this.handleHeatingThresholdTemperatureSet.bind(this));

    // Target display unit handlers
    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
      .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));

    this.updateCharacteristics();
  }

  async handleCurrentTemperatureGet() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[Thermostat] handleCurrentTemperatureGet status of "${this.display_name}" to ${this.thermostatTemperature}`
      );

    return this.f2c(this.thermostatTemperature);
  }

  async handleCurrentHeatingCoolingStateGet() {
    return this.Wyze2HomekitWorkingStates[this.thermostatWorkingState];
  }

  async handleTargetHeatingCoolingStateGet() {
    return this.Wyze2HomekitStates[this.thermostatModeSys];
  }

  async handleTargetTemperatureGet() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] handleTargetTemperatureGet Target Temp: " +
          this.c2f(this.getTargetTemperatureForSystemState())
      );
    return this.getTargetTemperatureForSystemState();
  }

  async handleCoolingThresholdTemperatureGet() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] handleCoolingThresholdTemperatureGet Cool Setpoint: " +
          this.thermostatCoolSetpoint
      );

    return this.f2c(this.thermostatCoolSetpoint);
  }

  async handleHeatingThresholdTemperatureGet() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] handleHeatingThresholdTemperatureGet Heat Setpoint: " +
          this.thermostatHeatSetpoint
      );

    return this.f2c(this.thermostatHeatSetpoint);
  }

  async handleTemperatureDisplayUnitsGet() {
    return this.Wyze2HomekitUnits[this.thermostatTempUnit];
  }

  // SET Methods for taking data from homekit and applying it to Wyze thermostat
  async handleTargetHeatingCoolingStateSet(value) {
    let targetState = this.getKey(this.Wyze2HomekitStates, value);
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[Thermostat] handleTargetHeatingCoolingStateSet status of "${this.display_name}" to ${targetState} (${value})`
      );

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

    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[Thermostat] handleTargetTemperatureSet status of "${this.display_name}" to ${targetTemp} for mode ${this.thermostatModeSys} which is ${currentStateNumber}`
      );

    // switch on current heating cooling state since we are NOT in auto mode
    switch (currentStateNumber) {
      case this.Wyze2HomekitStates.auto:
        if (this.plugin.config.logLevel == "debug")
          this.plugin.log.warn(
            `[Thermostat] WARNING: handleTargetTemperatureSet cannot set value since system is in AUTO`
          );
        break;
      case this.Wyze2HomekitStates.cool:
        if (this.plugin.config.logLevel == "debug")
          this.plugin.log.info(
            `[Thermostat] handleTargetTemperatureSet for COOLING`
          );
        this.handleCoolingThresholdTemperatureSet(value);
        break;
      case this.Wyze2HomekitStates.heat:
        if (this.plugin.config.logLevel == "debug")
          this.plugin.log.info(
            `[Thermostat] handleTargetTemperatureSet for HEATING`
          );
        this.handleHeatingThresholdTemperatureSet(value);
        break;
      case this.Wyze2HomekitStates.off:
        if (this.plugin.config.logLevell == "debug")
          this.plugin.log.warn(
            `[Thermostat] WARNING: handleTargetTemperatureSet cannot set value since system is OFF`
          );
        break;
      default:
        if (this.plugin.config.logLevel == "debug")
          this.plugin.log.warn(
            `[Thermostat] WARNING: handleTargetTemperatureSet cannot set value since system mode is UNDEFINED`
          );
        break;
    }

    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .updateValue(value);
  }

  async handleCoolingThresholdTemperatureSet(value) {
    let c = this.clamp(value, 10, 35);
    let val = Math.round(this.c2f(c));
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[Thermostat] handleCoolingThresholdTemperatureSet status of "${this.display_name}" to ${val}`
      );

    this.setCoolPoint(val);
    this.thermostatCoolSetpoint = val;
    this.service
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .updateValue(c);
  }

  async handleHeatingThresholdTemperatureSet(value) {
    let c = this.clamp(value, 0, 25);
    let val = Math.round(this.c2f(c));
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[Thermostat] handleHeatingThresholdTemperatureSet status of "${this.display_name}" to ${val}`
      );

    this.setHeatPoint(val);
    this.thermostatHeatSetpoint = val;
    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .updateValue(c);
  }

  async handleTemperatureDisplayUnitsSet(value) {
    // nothing for now, can use internally maybe
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[Thermostat] handleTemperatureDisplayUnitsSet status of "${this.display_name}" to ${value}`
      );
    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .updateValue(value);
  }

  // this is where we do the magic
  async updateCharacteristics(device) {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        `[Thermostat] Updating status of "${this.display_name}"`
      );

    // have to wait for this call to finish before updating or we might get null data
    this.thermostatGetIotProp().then(this.fillData.bind(this));
  }

  fillData() {
    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info("[Thermostat] Temp: " + this.thermostatTemperature);

    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] Target Temp: " +
          this.c2f(this.getTargetTemperatureForSystemState())
      );

    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] Mode Sys: " +
          this.thermostatModeSys +
          " for " +
          this.Wyze2HomekitStates[this.thermostatModeSys]
      );

    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] Working State: " +
          this.thermostatWorkingState +
          " for " +
          this.Wyze2HomekitWorkingStates[this.thermostatWorkingState]
      );

    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] Cool Setpoint: " + this.thermostatCoolSetpoint
      );

    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] Heat Setpoint: " + this.thermostatHeatSetpoint
      );

    if (this.plugin.config.logLevel == "debug")
      this.plugin.log.info(
        "[Thermostat] Temp Units: " +
          this.Wyze2HomekitUnits[this.thermostatTempUnit]
      );
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
};
