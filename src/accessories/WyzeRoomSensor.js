const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { markServiceOnline } = require("./offlineIndicator");

// Wyze CO_TH1 (Room Sensor) reports battery as a 4-level enum, not a
// percentage. Map to plausible percentages so HomeKit's BatteryLevel
// characteristic shows something useful.
//   1 = EMPTY, 2 = LOW, 3 = HALF, 4 = FULL
const ROOM_SENSOR_BATTERY_PCT = { 1: 5, 2: 25, 3: 60, 4: 100 };
const ROOM_SENSOR_BATTERY_LOW = { 1: true, 2: true, 3: false, 4: false };

module.exports = class WyzeRoomSensor extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    // Touch each characteristic once so HAP adds it to the service if missing.
    this.getTemperatureCharacteristic();
    this.getHumidityCharacteristic();
    this.getTemperatureStatusActiveCharacteristic();
    this.getHumidityStatusActiveCharacteristic();
    this.getBatteryCharacteristic();
    this.getIsBatteryLowCharacteristic();
  }

  getTemperatureSensorService() {
    let service = this.homeKitAccessory.getService(Service.TemperatureSensor);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[RoomSensor] Adding Temperature service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.TemperatureSensor);
    }
    return service;
  }

  getHumiditySensorService() {
    let service = this.homeKitAccessory.getService(Service.HumiditySensor);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[RoomSensor] Adding Humidity service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.HumiditySensor);
    }
    return service;
  }

  getBatteryService() {
    let service = this.homeKitAccessory.getService(Service.Battery);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[RoomSensor] Adding Battery service for "${this.display_name} (${this.mac})"`
        );
      service = this.homeKitAccessory.addService(Service.Battery);
    }
    return service;
  }

  getTemperatureCharacteristic() {
    return this.getTemperatureSensorService().getCharacteristic(Characteristic.CurrentTemperature);
  }

  getHumidityCharacteristic() {
    return this.getHumiditySensorService().getCharacteristic(Characteristic.CurrentRelativeHumidity);
  }

  getTemperatureStatusActiveCharacteristic() {
    return this.getTemperatureSensorService().getCharacteristic(Characteristic.StatusActive);
  }

  getHumidityStatusActiveCharacteristic() {
    return this.getHumiditySensorService().getCharacteristic(Characteristic.StatusActive);
  }

  getBatteryCharacteristic() {
    return this.getBatteryService().getCharacteristic(Characteristic.BatteryLevel);
  }

  getIsBatteryLowCharacteristic() {
    return this.getBatteryService().getCharacteristic(Characteristic.StatusLowBattery);
  }

  updateCharacteristics(device) {
    const params = device.device_params || {};
    const online = device.conn_state !== 0;
    markServiceOnline(this.getTemperatureSensorService(), online);
    markServiceOnline(this.getHumiditySensorService(), online);

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[RoomSensor] ${this.mac} (${this.display_name}) is offline — keeping last known values, marked inactive`
        );
      return;
    }

    // Temperature comes from Wyze in tenths-of-°F (e.g. 712 = 71.2°F).
    // Convert to °F first, then to °C for HomeKit (which uses °C internally).
    const tempF = typeof params.temperature === "number" ? params.temperature / 10 : null;
    const tempC = tempF != null ? (tempF - 32) / 1.8 : null;
    const humidityPct = typeof params.humidity === "number" ? params.humidity : null;

    const batteryEnum = params.battery;
    const batteryPct = ROOM_SENSOR_BATTERY_PCT[batteryEnum] ?? 100;
    const batteryLow = ROOM_SENSOR_BATTERY_LOW[batteryEnum] ?? false;

    if (tempC != null) this.getTemperatureCharacteristic().updateValue(tempC);
    if (humidityPct != null) this.getHumidityCharacteristic().updateValue(humidityPct);
    this.getBatteryCharacteristic().updateValue(batteryPct);
    this.getIsBatteryLowCharacteristic().updateValue(
      batteryLow
        ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
    );

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[RoomSensor] ${this.mac} (${this.display_name}): ` +
          (tempF != null ? `${tempF.toFixed(1)}°F, ` : "") +
          (humidityPct != null ? `${humidityPct}% RH, ` : "") +
          `battery ${batteryPct}%${batteryLow ? " (low)" : ""}`
      );
  }
};
