const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { propertyIds: PIDs } = require("wyze-api");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeLight extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getCharacteristic(Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));
    this.getCharacteristic(Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this));
    this.getCharacteristic(Characteristic.ColorTemperature)
      .onSet(this.setColorTemperature.bind(this));
  }

  async getOn() {
    return this._switchState === 1;
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Lightbulb);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Light] Adding service for "${this.display_name} (${this.mac})"`);
      service = this.homeKitAccessory.addService(Service.Lightbulb);
    }
    return service;
  }

  getCharacteristic(characteristic) {
    return this.getService().getCharacteristic(characteristic);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async updateCharacteristics(device) {
    const online = device.conn_state !== 0;
    markServiceOnline(this.getService(), online);

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Light] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }
    if (!device.device_params) return;

    // Skip pushing On from the poll while a just-issued command's grace
    // period is active, or if it hasn't actually changed — avoids
    // reverting the optimistic UI update before Wyze's API propagates it.
    const switchState = device.device_params.switch_state;
    const isOn = switchState === 1;
    if (switchState !== this._switchState && !this.inCommandGrace()) {
      this._switchState = switchState;
      this.getCharacteristic(Characteristic.On).updateValue(isOn);
    }

    // NOTE: this is one extra API call per light per refresh cycle (on top
    // of the bulk getObjectList). With many bulbs configured, this adds up
    // against the Wyze rate limit. Brightness + color-temp aren't returned
    // by getObjectList, so we have to fetch them separately.
    let propertyList;
    try {
      propertyList = await this.plugin.client.getDevicePID(this.mac, this.product_model);
    } catch (err) {
      this.plugin.log.error(
        `[Light] getDevicePID failed for ${this.display_name}: ${err.message || err}`
      );
      // Mark inactive so the user sees something is off, but leave the On
      // characteristic at its (still valid) value from the bulk list.
      markServiceOnline(this.getService(), false);
      return;
    }

    let brightness = null;
    let colorTempK = null;
    for (const property of propertyList?.data?.property_list ?? []) {
      switch (property.pid) {
        case PIDs.BRIGHTNESS:
          brightness = Number(property.value);
          this.getCharacteristic(Characteristic.Brightness).updateValue(
            this.plugin.client.checkBrightnessValue(brightness)
          );
          break;
        case PIDs.COLOR_TEMP:
          colorTempK = Number(property.value);
          this.getCharacteristic(Characteristic.ColorTemperature).updateValue(
            this.plugin.client.checkColorTemp(this.plugin.client.kelvinToMired(colorTempK))
          );
          break;
      }
    }

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Light] ${this.mac} (${this.display_name}): ${isOn ? "on" : "off"}` +
          (brightness != null ? `, ${brightness}%` : "") +
          (colorTempK != null ? `, ${colorTempK}K` : "")
      );
  }

  async setOn(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Light] Setting power for ${this.mac} (${this.display_name}) to ${value ? "on" : "off"}`
      );
    this._switchState = value ? 1 : 0;
    this.armCommandGrace(15000);
    this.plugin.client.lightPower(this.mac, this.product_model, value ? "1" : "0").catch((e) => {
      this.clearCommandGrace();
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Light] Command error for "${this.display_name}": ${e}`);
    });
  }

  async setBrightness(value) {
    await this.sleep(250);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Light] Setting brightness for ${this.mac} (${this.display_name}) to ${value}`
      );
    this.plugin.client.setBrightness(this.mac, this.product_model, value).catch((e) => {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Light] Command error for "${this.display_name}": ${e}`);
    });
  }

  async setColorTemperature(value) {
    await this.sleep(500);
    // homeKitColorTempToWyze stretches HomeKit's wider mireds range
    // (140–500) linearly across Wyze's narrower Kelvin range (2700–6500)
    // so the slider feels native even though Wyze's bulbs can't reach
    // either extreme of the HomeKit slider.
    const wyzeValue = this.plugin.client.homeKitColorTempToWyze(value);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Light] Setting color temp for ${this.mac} (${this.display_name}) to ${value} mireds (${wyzeValue}K)`
      );
    this.plugin.client.setColorTemperature(this.mac, this.product_model, wyzeValue).catch((e) => {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[Light] Command error for "${this.display_name}": ${e}`);
    });
  }
};
