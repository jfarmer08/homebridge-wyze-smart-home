const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

// Future ideas:
//   - Fan mode switch (auto / circ / on)
//   - Per-room temp sensors that report under the same accessory
//   - "Time-to-temperature" estimate as a custom characteristic

const Wyze2HomekitUnits = { C: 0, F: 1 };
const Wyze2HomekitStates = { off: 0, heat: 1, cool: 2, auto: 3 };
const Wyze2HomekitWorkingStates = { idle: 0, heating: 1, cooling: 2 };

// Inverted lookup so we can convert HomeKit numeric state → Wyze string mode
// without relying on Object.keys() insertion order.
const HomekitState2Wyze = Object.fromEntries(
  Object.entries(Wyze2HomekitStates).map(([k, v]) => [v, k])
);

module.exports = class WyzeThermostat extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // Sensible defaults until the first thermostatGetIotProp succeeds.
    this.thermostatTemperature = 69.0;
    this.thermostatCoolSetpoint = 65.0;
    this.thermostatHeatSetpoint = 72.0;
    this.thermostatModeSys = "auto";
    this.thermostatWorkingState = "idle";
    this.thermostatTempUnit = "F";
    this.thermostatHumidity = 50;

    this.service = this.getThermostatService();

    this.service
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
      .onSet(this.handleTargetHeatingCoolingStateSet.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .onGet(this.handleTargetTemperatureGet.bind(this))
      .onSet(this.handleTargetTemperatureSet.bind(this));

    this.service
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .onGet(this.handleCoolingThresholdTemperatureGet.bind(this))
      .onSet(this.handleCoolingThresholdTemperatureSet.bind(this));

    // Wyze thermostats run hotter than HomeKit's default 25°C max.
    // h/t @fennix in homebridge-fenix-v24-wifi for the maxValue tweak.
    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
      .onSet(this.handleHeatingThresholdTemperatureSet.bind(this))
      .setProps({ maxValue: 35 });

    this.service
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleCurrentHumidityGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
      .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));
  }

  getThermostatService() {
    let service = this.homeKitAccessory.getService(Service.Thermostat);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Thermostat] Adding service for "${this.display_name}"`);
      service = this.homeKitAccessory.addService(Service.Thermostat);
    }
    return service;
  }

  // ---- Get handlers ---------------------------------------------------------

  async handleCurrentTemperatureGet() {
    return this.f2c(this.thermostatTemperature);
  }

  async handleCurrentHeatingCoolingStateGet() {
    return Wyze2HomekitWorkingStates[this.thermostatWorkingState] ?? Wyze2HomekitWorkingStates.idle;
  }

  async handleTargetHeatingCoolingStateGet() {
    return Wyze2HomekitStates[this.thermostatModeSys] ?? Wyze2HomekitStates.off;
  }

  async handleTargetTemperatureGet() {
    return this.getTargetTemperatureForSystemState();
  }

  async handleCoolingThresholdTemperatureGet() {
    return this.f2c(this.thermostatCoolSetpoint);
  }

  async handleHeatingThresholdTemperatureGet() {
    return this.f2c(this.thermostatHeatSetpoint);
  }

  async handleCurrentHumidityGet() {
    return this.thermostatHumidity;
  }

  async handleTemperatureDisplayUnitsGet() {
    return Wyze2HomekitUnits[this.thermostatTempUnit] ?? Wyze2HomekitUnits.F;
  }

  // ---- Set handlers ---------------------------------------------------------

  async handleTargetHeatingCoolingStateSet(value) {
    const targetState = HomekitState2Wyze[value];
    if (!targetState) {
      this.plugin.log.error(`[Thermostat] Unknown HomeKit state: ${value}`);
      return;
    }
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[Thermostat] Set mode "${this.display_name}": ${targetState}`);
    try {
      await this.setHvacMode(targetState);
      this.thermostatModeSys = targetState;
      this.service
        .getCharacteristic(Characteristic.TargetTemperature)
        .updateValue(this.getTargetTemperatureForSystemState());
    } catch (err) {
      this.plugin.log.error(`[Thermostat] setHvacMode failed: ${err.message || err}`);
      throw err;
    }
  }

  async handleTargetTemperatureSet(value) {
    const currentStateNumber = Wyze2HomekitStates[this.thermostatModeSys];
    // In auto/off, HomeKit shouldn't let you slide TargetTemperature, but
    // some clients do. Only act on heat/cool — auto uses the cooling/heating
    // threshold characteristics directly.
    switch (currentStateNumber) {
      case Wyze2HomekitStates.cool:
        return this.handleCoolingThresholdTemperatureSet(value);
      case Wyze2HomekitStates.heat:
        return this.handleHeatingThresholdTemperatureSet(value);
      default:
        if (this.plugin.config.pluginLoggingEnabled)
          this.plugin.log(
            `[Thermostat] Ignoring target-temp set for "${this.display_name}" — mode is ${this.thermostatModeSys}`
          );
    }
  }

  async handleCoolingThresholdTemperatureSet(value) {
    const c = this.clamp(value, 10, 35);
    const valF = Math.round(this.c2f(c));
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[Thermostat] Set cool setpoint "${this.display_name}": ${valF}°F`);
    try {
      await this.setCoolPoint(valF);
      this.thermostatCoolSetpoint = valF;
      this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(c);
    } catch (err) {
      this.plugin.log.error(`[Thermostat] setCoolPoint failed: ${err.message || err}`);
      throw err;
    }
  }

  async handleHeatingThresholdTemperatureSet(value) {
    const c = this.clamp(value, 0, 35);
    const valF = Math.round(this.c2f(c));
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[Thermostat] Set heat setpoint "${this.display_name}": ${valF}°F`);
    try {
      await this.setHeatPoint(valF);
      this.thermostatHeatSetpoint = valF;
      this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(c);
    } catch (err) {
      this.plugin.log.error(`[Thermostat] setHeatPoint failed: ${err.message || err}`);
      throw err;
    }
  }

  async handleTemperatureDisplayUnitsSet(value) {
    // NOTE: this only updates HomeKit's own display setting — the Wyze
    // app's display unit isn't synced. There's no public Wyze IoT prop
    // that controls thermostat display unit from the API.
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[Thermostat] Set HomeKit display units "${this.display_name}": ${value}`);
    this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits).updateValue(value);
  }

  // ---- Update cycle ---------------------------------------------------------

  async updateCharacteristics(device) {
    // Thermostat is safety-critical-adjacent (people might rely on the
    // displayed mode when deciding whether to crank the heat). Use
    // StatusFault on the bulk-list connection state so the user sees
    // staleness without losing the last known setpoints.
    const online = device?.conn_state !== 0;
    markServiceOnline(this.service, online, "fault");

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Thermostat] "${this.display_name}" is offline — keeping last known state, marked with fault`
        );
      return;
    }

    // NOTE: one extra IoT-prop call per refresh on top of the bulk
    // getObjectList. The bulk list doesn't include thermostat state.
    let response;
    try {
      response = await this.plugin.client.thermostatGetIotProp(this.mac);
    } catch (e) {
      this.plugin.log.error(`[Thermostat] thermostatGetIotProp failed: ${e.message || e}`);
      markServiceOnline(this.service, false, "fault");
      return;
    }

    const properties = response?.data?.props;
    if (!properties) {
      this.plugin.log.error(`[Thermostat] empty props for "${this.display_name}"`);
      return;
    }

    for (const [prop, value] of Object.entries(properties)) {
      switch (prop) {
        case "temperature":   this.thermostatTemperature = Math.round(value); break;
        case "cool_sp":       this.thermostatCoolSetpoint = Math.round(value); break;
        case "heat_sp":       this.thermostatHeatSetpoint = Math.round(value); break;
        case "working_state": this.thermostatWorkingState = value; break;
        case "temp_unit":     this.thermostatTempUnit = value; break;
        case "mode_sys":      this.thermostatModeSys = value; break;
        case "humidity":      this.thermostatHumidity = Math.round(value); break;
      }
    }
    if (response?.ts) this.lastTimestamp = response.ts;

    // Push every read characteristic so HomeKit reflects the new state
    // immediately (was previously only humidity — others stayed stale
    // until HomeKit happened to call onGet).
    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .updateValue(this.f2c(this.thermostatTemperature));
    this.service
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .updateValue(this.thermostatHumidity);
    this.service
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .updateValue(Wyze2HomekitWorkingStates[this.thermostatWorkingState] ?? Wyze2HomekitWorkingStates.idle);
    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .updateValue(Wyze2HomekitStates[this.thermostatModeSys] ?? Wyze2HomekitStates.off);
    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .updateValue(this.getTargetTemperatureForSystemState());
    this.service
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .updateValue(this.f2c(this.thermostatCoolSetpoint));
    this.service
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .updateValue(this.f2c(this.thermostatHeatSetpoint));

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Thermostat] "${this.display_name}": ${this.thermostatTemperature}°${this.thermostatTempUnit}` +
          ` ${this.thermostatHumidity}% RH, mode ${this.thermostatModeSys}, ` +
          `setpoints H${this.thermostatHeatSetpoint}/C${this.thermostatCoolSetpoint}, ` +
          `state ${this.thermostatWorkingState}`
      );
  }

  // ---- Wyze IoT setters -----------------------------------------------------

  async setHvacMode(value) {
    return this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, "mode_sys", value);
  }

  async setHeatPoint(value) {
    return this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, "heat_sp", value);
  }

  async setCoolPoint(value) {
    return this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, "cool_sp", value);
  }

  // Available but unwired — kept for callers that may use them later.
  async setPreset(value) {
    return this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, "config_scenario", value);
  }
  async setFanMode(value) {
    // Wyze accepts: 'auto', 'circ', 'on'
    return this.plugin.client.thermostatSetIotProp(this.mac, this.product_model, "fan_mode", value);
  }

  // ---- Helpers --------------------------------------------------------------

  getTargetTemperatureForSystemState() {
    // Wyze doesn't reliably push working-state, so derive a reasonable
    // target from the current mode + setpoints + measured temp.
    const s = Wyze2HomekitStates[this.thermostatModeSys];
    if (s === Wyze2HomekitStates.cool) return this.f2c(this.thermostatCoolSetpoint);
    if (s === Wyze2HomekitStates.heat) return this.f2c(this.thermostatHeatSetpoint);
    if (s === Wyze2HomekitStates.auto) {
      if (this.thermostatCoolSetpoint < this.thermostatTemperature) return this.f2c(this.thermostatCoolSetpoint);
      if (this.thermostatHeatSetpoint > this.thermostatTemperature) return this.f2c(this.thermostatHeatSetpoint);
    }
    return this.f2c(this.thermostatTemperature);
  }

  f2c(fahrenheit) { return (fahrenheit - 32.0) / 1.8; }
  c2f(celsius)    { return celsius * 1.8 + 32.0; }

  clamp(number, min, max) {
    if (number < min || number > max) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Thermostat] Clamping ${number} to [${min}, ${max}]`);
    }
    return Math.max(min, Math.min(number, max));
  }
};
