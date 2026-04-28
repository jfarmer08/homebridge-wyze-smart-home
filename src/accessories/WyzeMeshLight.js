const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { propertyIds: PIDs } = require("wyze-api");
const { markServiceOnline } = require("./offlineIndicator");

module.exports = class WyzeMeshLight extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getCharacteristic(Characteristic.On).on("set", this.setOn.bind(this));
    this.getCharacteristic(Characteristic.Brightness).on("set", this.setBrightness.bind(this));
    this.getCharacteristic(Characteristic.ColorTemperature).on("set", this.setColorTemperature.bind(this));
    this.getCharacteristic(Characteristic.Hue).on("set", this.setHue.bind(this));
    this.getCharacteristic(Characteristic.Saturation).on("set", this.setSaturation.bind(this));

    // HomeKit fires Hue and Saturation as two independent set events but
    // Wyze only accepts a combined color value. Cache one and wait for the
    // other before pushing to the device.
    // Pattern from: github.com/QuickSander/homebridge-http-rgb-push
    this.cache = {};
    this.cacheUpdated = false;
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Lightbulb);
    if (!service) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(`[MeshLight] Adding service for "${this.display_name} (${this.mac})"`);
      service = this.homeKitAccessory.addService(Service.Lightbulb);
    }
    return service;
  }

  getCharacteristic(characteristic) {
    return this.getService().getCharacteristic(characteristic);
  }

  async updateCharacteristics(device) {
    const online = device.conn_state !== 0;
    markServiceOnline(this.getService(), online);

    if (!online) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[MeshLight] ${this.mac} (${this.display_name}) is offline — keeping last known state, marked inactive`
        );
      return;
    }

    const isOn = device.device_params.switch_state === 1;
    this.getCharacteristic(Characteristic.On).updateValue(isOn);

    // NOTE: one extra getDevicePID call per bulb per refresh on top of the
    // bulk getObjectList. Brightness / color temp / color aren't returned
    // by the bulk list so we have to fetch them separately.
    let propertyList;
    try {
      propertyList = await this.plugin.client.getDevicePID(this.mac, this.product_model);
    } catch (err) {
      this.plugin.log.error(
        `[MeshLight] getDevicePID failed for ${this.display_name}: ${err.message || err}`
      );
      markServiceOnline(this.getService(), false);
      return;
    }

    let brightness = null;
    let colorTempK = null;
    let color = null;
    for (const property of propertyList?.data?.property_list ?? []) {
      if (!this.isValidProperty(property)) continue;
      switch (property.pid) {
        case PIDs.BRIGHTNESS:
          brightness = property.value;
          this.updateBrightness(brightness);
          break;
        case PIDs.COLOR_TEMP:
          colorTempK = property.value;
          this.updateColorTemp(colorTempK);
          break;
        case PIDs.COLOR:
          color = property.value;
          this.updateColor(color);
          break;
      }
    }

    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] ${this.mac} (${this.display_name}): ${isOn ? "on" : "off"}` +
          (brightness != null ? `, ${brightness}%` : "") +
          (colorTempK != null ? `, ${colorTempK}K` : "") +
          (color != null ? `, color #${color}` : "")
      );
  }

  isValidProperty(property) {
    // Wyze sometimes reports placeholder/garbage values when a bulb hasn't
    // synced yet. "undefi" is a truncated "undefined" string we've seen in
    // the wild. Treat both as missing rather than blowing away cached state.
    if (property.value != null && property.value !== "0" && property.value !== "undefi") {
      return true;
    }
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(`[MeshLight] Skipping invalid property: ${JSON.stringify(property)}`);
    return false;
  }

  updateBrightness(value) {
    this.getCharacteristic(Characteristic.Brightness).updateValue(
      this.plugin.client.checkBrightnessValue(value)
    );
  }

  updateColorTemp(value) {
    this.getCharacteristic(Characteristic.ColorTemperature).updateValue(
      this.plugin.client.checkColorTemp(this.plugin.client.kelvinToMired(value))
    );
  }

  updateColor(value) {
    const { hue, saturation } = this.plugin.client.wyzeColorToHomeKit(value);
    this.getCharacteristic(Characteristic.Hue).updateValue(hue);
    this.getCharacteristic(Characteristic.Saturation).updateValue(saturation);
    this.cache.hue = hue;
    this.cache.saturation = saturation;
  }

  async setOn(value, callback) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Set power "${this.display_name} (${this.mac})": ${value ? "on" : "off"}`
      );
    try {
      await this.plugin.client.lightMeshPower(this.mac, this.product_model, value ? "1" : "0");
      callback();
    } catch (e) {
      this.plugin.log.error(`[MeshLight] setOn failed for ${this.display_name}: ${e.message || e}`);
      callback(e);
    }
  }

  async setBrightness(value, callback) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Set brightness "${this.display_name} (${this.mac})": ${value}`
      );
    try {
      await this.plugin.client.setMeshBrightness(this.mac, this.product_model, value);
      callback();
    } catch (e) {
      this.plugin.log.error(`[MeshLight] setBrightness failed for ${this.display_name}: ${e.message || e}`);
      callback(e);
    }
  }

  async setColorTemperature(value, callback) {
    if (value == null) return;
    const wyzeValue = this.plugin.client.homeKitColorTempToWyze(value);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Set color temp "${this.display_name} (${this.mac})": ${value} mireds → ${wyzeValue}K`
      );
    try {
      await this.plugin.client.setMeshColorTemperature(this.mac, this.product_model, wyzeValue);
      callback();
    } catch (e) {
      this.plugin.log.error(`[MeshLight] setColorTemperature failed for ${this.display_name}: ${e.message || e}`);
      callback(e);
    }
  }

  async setHue(value, callback) {
    if (value == null) return;
    this.cache.hue = value;
    await this._maybeFlushColor(callback, "hue");
  }

  async setSaturation(value, callback) {
    if (value == null) return;
    this.cache.saturation = value;
    await this._maybeFlushColor(callback, "saturation");
  }

  // HomeKit fires hue + saturation independently. We hold the first one in
  // cache and push to Wyze on the second so it sees a complete color update.
  async _maybeFlushColor(callback, source) {
    if (!this.cacheUpdated) {
      this.cacheUpdated = true;
      callback();
      return;
    }
    this.cacheUpdated = false;
    const hexValue = this.plugin.client.homeKitColorToWyze(this.cache.hue, this.cache.saturation);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Set color "${this.display_name} (${this.mac})": h=${this.cache.hue} s=${this.cache.saturation} → ${hexValue}`
      );
    try {
      // Either setMeshHue or setMeshSaturation works — they both push the
      // combined hex color. Pick based on which event triggered the flush.
      if (source === "hue") {
        await this.plugin.client.setMeshHue(this.mac, this.product_model, hexValue);
      } else {
        await this.plugin.client.setMeshSaturation(this.mac, this.product_model, hexValue);
      }
      callback();
    } catch (e) {
      this.plugin.log.error(`[MeshLight] setColor failed for ${this.display_name}: ${e.message || e}`);
      callback(e);
    }
  }
};
