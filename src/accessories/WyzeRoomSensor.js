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

    // Log the raw params payload once per accessory per startup. If a
    // user reports the wrong temperature scale or a stuck battery
    // reading, this is what we ask them to share.
    if (!this._loggedRawOnce) {
      this._loggedRawOnce = true;
      this.plugin.log.info(
        `[RoomSensor] First update for "${this.display_name}" (${this.mac}). ` +
        `Save this if you're debugging:\n${JSON.stringify(params, null, 2)}`
      );
    }

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[RoomSensor] ${this.mac} (${this.display_name}) is offline ` +
          `(iot_state=${JSON.stringify(params.iot_state)}, conn_state=${device.conn_state}) — ` +
          `keeping last known values, marked inactive`
        );
      return;
    }

    // Wyze typically reports temperature in tenths of °F (e.g. 712 = 71.2°F).
    // Some firmwares may report in whole °F or °C — sanity-check the
    // resulting Celsius value and warn if it's clearly nonsense so we know
    // to revisit the conversion.
    const rawTemp = params.temperature;
    let tempC = null;
    let tempLogF = null;
    if (typeof rawTemp === "number") {
      const tempF = rawTemp / 10;
      tempC = (tempF - 32) / 1.8;
      tempLogF = tempF;
      if (tempC < -50 || tempC > 80) {
        this.plugin.log.warn?.(
          `[RoomSensor] "${this.display_name}" temperature out of plausible range — ` +
          `raw=${rawTemp} → ${tempF.toFixed(1)}°F / ${tempC.toFixed(1)}°C. ` +
          `Wyze may be reporting whole degrees instead of tenths on this firmware.`
        );
      }
    } else if (rawTemp != null) {
      this.plugin.log.warn?.(
        `[RoomSensor] "${this.display_name}" non-numeric temperature: ${JSON.stringify(rawTemp)}`
      );
    }

    const rawHumidity = params.humidity;
    let humidityPct = null;
    if (typeof rawHumidity === "number") {
      humidityPct = rawHumidity;
      if (humidityPct < 0 || humidityPct > 100) {
        this.plugin.log.warn?.(
          `[RoomSensor] "${this.display_name}" humidity out of range: ${humidityPct}%`
        );
      }
    } else if (rawHumidity != null) {
      this.plugin.log.warn?.(
        `[RoomSensor] "${this.display_name}" non-numeric humidity: ${JSON.stringify(rawHumidity)}`
      );
    }

    const batteryEnum = params.battery;
    const batteryPct = ROOM_SENSOR_BATTERY_PCT[batteryEnum] ?? null;
    const batteryLow = ROOM_SENSOR_BATTERY_LOW[batteryEnum] ?? false;
    if (batteryPct == null && batteryEnum != null) {
      this.plugin.log.warn?.(
        `[RoomSensor] "${this.display_name}" unknown battery enum value: ${JSON.stringify(batteryEnum)}. ` +
        `Expected 1 (EMPTY), 2 (LOW), 3 (HALF), or 4 (FULL).`
      );
    }

    if (tempC != null) this.getTemperatureCharacteristic().updateValue(tempC);
    if (humidityPct != null) this.getHumidityCharacteristic().updateValue(humidityPct);
    if (batteryPct != null) {
      this.getBatteryCharacteristic().updateValue(batteryPct);
      this.getIsBatteryLowCharacteristic().updateValue(
        batteryLow
          ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
          : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      );
    }

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[RoomSensor] ${this.mac} (${this.display_name}): ` +
          (tempLogF != null ? `${tempLogF.toFixed(1)}°F, ` : "temp=? ") +
          (humidityPct != null ? `${humidityPct}% RH, ` : "humidity=? ") +
          (batteryPct != null ? `battery ${batteryPct}%${batteryLow ? " (low)" : ""}` : `battery=?`) +
          ` (rssi=${params.rssi ?? "?"})`
      );
  }
};
