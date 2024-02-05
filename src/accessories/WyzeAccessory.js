const { Service, Characteristic } = require("../types");

// Responses from the Wyze API can lag a little after a new value is set
const UPDATE_THROTTLE_MS = 1000;

module.exports = class WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    this.updating = false;
    this.lastTimestamp = null;

    this.plugin = plugin;
    this.homeKitAccessory = homeKitAccessory;
  }

  // Default Prop
  get display_name() {
    return this.homeKitAccessory.displayName;
  }
  get mac() {
    return this.homeKitAccessory.context.mac;
  }
  get product_type() {
    return this.homeKitAccessory.context.product_type;
  }
  get product_model() {
    return this.homeKitAccessory.context.product_model;
  }

  // from thermostat
  get thermostatTemperature() {
    return this.homeKitAccessory.context.device_params?.temperature;
  }
  set thermostatTemperature(value) {
    this.homeKitAccessory.context.device_params.temperature = value;
  }

  get thermostatModeSys() {
    return this.homeKitAccessory.context.device_params?.mode_sys;
  }
  set thermostatModeSys(value) {
    this.homeKitAccessory.context.device_params.mode_sys = value;
  }

  get thermostatWorkingState() {
    return this.homeKitAccessory.context.device_params?.working_state;
  }
  set thermostatWorkingState(value) {
    this.homeKitAccessory.context.device_params.working_state = value;
  }

  get thermostatCoolSetpoint() {
    return this.homeKitAccessory.context.device_params?.cool_sp;
  }
  set thermostatCoolSetpoint(value) {
    this.homeKitAccessory.context.device_params.cool_sp = value;
  }

  get thermostatHeatSetpoint() {
    return this.homeKitAccessory.context.device_params?.heat_sp;
  }
  set thermostatHeatSetpoint(value) {
    this.homeKitAccessory.context.device_params.heat_sp = value;
  }

  get thermostatTempUnit() {
    return this.homeKitAccessory.context.device_params?.temp_unit;
  }
  set thermostatTempUnit(value) {
    this.homeKitAccessory.context.device_params.temp_unit = value;
  }

  get thermostatTime2Temp() {
    return this.homeKitAccessory.context.device_params?.time2temp_val;
  }
  set thermostatTime2Temp(value) {
    this.homeKitAccessory.context.device_params.time2temp_val = value;
  }

  get thermostatConnState() {
    return this.homeKitAccessory.context.conn_state;
  }

  /** Determines whether this accessory matches the given Wyze device */
  matches(device) {
    return this.mac === device.mac;
  }

  async update(device, timestamp) {
    const productType = device.product_type;

    switch (productType) {
      case "Thermostat":
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
          conn_state: device.conn_state,
          push_switch: device.push_switch,
          device_params: (device.device_params = {
            temperature: this.thermostatTemperature,
            cool_sp: this.thermostatCoolSetpoint,
            heat_sp: this.thermostatHeatSetpoint,
            working_state: this.thermostatWorkingState,
            temp_unit: this.thermostatTempUnit,
            mode_sys: this.thermostatModeSys,
            time2temp_val: this.thermostatTime2Temp,
          }),
        };
        break;
      default:
        this.homeKitAccessory.context = {
          mac: device.mac,
          product_type: device.product_type,
          product_model: device.product_model,
          nickname: device.nickname,
        };
        break;
    }

    this.homeKitAccessory
      .getService(Service.AccessoryInformation)
      .updateCharacteristic(Characteristic.Name, device.nickname)
      .updateCharacteristic(Characteristic.Manufacturer, "Wyze")
      .updateCharacteristic(Characteristic.Model, device.product_model)
      .updateCharacteristic(Characteristic.SerialNumber, device.mac)
      .updateCharacteristic(
        Characteristic.FirmwareRevision,
        device.firmware_ver
      );

    if (this.shouldUpdateCharacteristics(timestamp)) {
      this.updateCharacteristics(device);
    }
  }
  shouldUpdateCharacteristics(timestamp) {
    if (this.updating) {
      return false;
    }

    if (
      this.lastTimestamp &&
      timestamp <= this.lastTimestamp + UPDATE_THROTTLE_MS
    ) {
      return false;
    }

    return true;
  }

  updateCharacteristics(device) {
    //
  }

  // Thermostat Methods
  async thermostatGetIotProp() {
    // Set Defaults
    this.thermostatTemperature = 69.0;
    this.thermostatCoolSetpoint = 65.0;
    this.thermostatHeatSetpoint = 72.0;
    this.thermostatModeSys = "auto";
    this.thermostatWorkingState = "idle";
    this.thermostatTempUnit = "F";

    let response;
    try {
      this.updating = true;
      response = await this.plugin.client.thermostatGetIotProp(this.mac);
      let properties = response.data.props;
      const prop_key = Object.keys(properties);
      for (const element of prop_key) {
        const prop = element;
        switch (prop) {
          case "temperature":
            this.homeKitAccessory.context.device_params.temperature =
              Math.round(properties[prop]);
            continue;
          case "cool_sp":
            this.homeKitAccessory.context.device_params.cool_sp = Math.round(
              properties[prop]
            );
            continue;
          case "heat_sp":
            this.homeKitAccessory.context.device_params.heat_sp = Math.round(
              properties[prop]
            );
            continue;
          case "working_state":
            this.homeKitAccessory.context.device_params.working_state =
              properties[prop];
            continue;
          case "temp_unit":
            this.homeKitAccessory.context.device_params.temp_unit =
              properties[prop];
            continue;
          case "mode_sys":
            this.homeKitAccessory.context.device_params.mode_sys =
              properties[prop];
            continue;
          case "iot_state":
            this.homeKitAccessory.context.conn_state = properties[prop];
            continue;
          case "time2temp_val":
            this.homeKitAccessory.context.device_params.thermostatTime2Temp =
              properties[prop];
            continue;
        }
      }
      this.lastTimestamp = response.ts;
    } catch (e) {
      this.plugin.log.error("Error in thermostat: " + e);
    } finally {
      this.updating = false;
      return response;
    }
  }

  async setPreset(value) {
    const response = await this.plugin.client.thermostatSetIotProp(
      this.mac,
      this.product_model,
      "config_scenario",
      value
    );
    return response;
  }
  // auto, on, off / / ['auto', 'circ', 'on']
  async setFanMode(value) {
    const response = await this.plugin.client.thermostatSetIotProp(
      this.mac,
      this.product_model,
      "fan_mode",
      value
    );
    return response;
  }
  // auto, heat, cool
  async setHvacMode(value) {
    const response = await this.plugin.client.thermostatSetIotProp(
      this.mac,
      this.product_model,
      "mode_sys",
      value
    );
    return response;
  }

  // heat stop point
  async setHeatPoint(value) {
    const response = await this.plugin.client.thermostatSetIotProp(
      this.mac,
      this.product_model,
      "heat_sp",
      value
    );
    return response;
  }

  // Cool stop point
  async setCoolPoint(value) {
    const response = await this.plugin.client.thermostatSetIotProp(
      this.mac,
      this.product_model,
      "cool_sp",
      value
    );
    return response;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms * 1000));
  }
};
