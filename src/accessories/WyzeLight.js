const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");

const WYZE_API_BRIGHTNESS_PROPERTY = "P1501";
const WYZE_API_COLOR_TEMP_PROPERTY = "P1502";
const WYZE_COLOR_TEMP_MIN = 2700;
const WYZE_COLOR_TEMP_MAX = 6500;
const HOMEKIT_COLOR_TEMP_MIN = 500;
const HOMEKIT_COLOR_TEMP_MAX = 140;

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class WyzeLight extends WyzeAccessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getCharacteristic(Characteristic.On).on("set", this.setOn.bind(this));
    this.getCharacteristic(Characteristic.Brightness).on(
      "set",
      this.setBrightness.bind(this)
    );
    this.getCharacteristic(Characteristic.ColorTemperature).on(
      "set",
      this.setColorTemperature.bind(this)
    );
  }

  async updateCharacteristics(device) {
    if (device.conn_state === 0) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[Light] Updating status ${this.mac} (${this.display_name}) to noResponse`
        );
      this.getCharacteristic(Characteristic.On).updateValue(noResponse);
    } else {
      if (this.plugin.config.pluginLoggingEnabled) {
        this.plugin.log(
          `[Light] Updating status of ${this.mac} (${this.display_name})`
        );
      }
      this.getCharacteristic(Characteristic.On).updateValue(
        device.device_params.switch_state
      );

      const propertyList = await this.plugin.client.getDevicePID(
        this.mac,
        this.product_model
      );
      for (const property of propertyList.data.property_list) {
        switch (property.pid) {
          case WYZE_API_BRIGHTNESS_PROPERTY:
            this.updateBrightness(property.value);
            break;

          case WYZE_API_COLOR_TEMP_PROPERTY:
            this.updateColorTemp(property.value);
            break;
        }
      }
    }
  }

  updateBrightness(value) {
    if (this.plugin.config.pluginLoggingEnabled) {
      this.plugin.log(
        `[Light] Updating brightness of ${this.mac} (${this.display_name})`
      );
    }
    this.getCharacteristic(Characteristic.Brightness).updateValue(value);
  }

  updateColorTemp(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Light] Setting color temperature for ${this.mac} (${
          this.display_name
        }) to ${value} (${this.plugin.client.kelvinToMired(value)})`
      );
    this.getCharacteristic(Characteristic.ColorTemperature).updateValue(
      this.plugin.client.kelvinToMired(value)
    );
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Lightbulb);

    if (!service) {
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

  async setOn(value, callback) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Light] Setting power for ${this.mac} (${this.display_name}) to ${value}`
      );

    try {
      await this.plugin.client.lightPower(
        this.mac,
        this.product_model,
        value ? "1" : "0"
      );
      callback();
    } catch (e) {
      callback(e);
    }
  }

  async setBrightness(value, callback) {
    await this.sleep(250);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Light] Setting brightness for ${this.mac} (${this.display_name}) to ${value}`
      );

    try {
      await this.plugin.client.setBrightness(
        this.mac,
        this.product_model,
        value
      );
      callback();
    } catch (e) {
      callback(e);
    }
  }

  // TODO: Issues when Color Temp higher then
  async setColorTemperature(value, callback) {
    await this.sleep(500);
    const floatValue = this.plugin.client.rangeToFloat(
      value,
      HOMEKIT_COLOR_TEMP_MIN,
      HOMEKIT_COLOR_TEMP_MAX
    );
    const wyzeValue = this.plugin.client.floatToRange(
      floatValue,
      WYZE_COLOR_TEMP_MIN,
      WYZE_COLOR_TEMP_MAX
    );
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[Light] Setting color temperature for ${this.mac} (${this.display_name}) to ${value} (${wyzeValue})`
      );

    try {
      await this.plugin.client.setColorTemperature(
        this.mac,
        this.product_model,
        wyzeValue
      );
      callback();
    } catch (e) {
      callback(e);
    }
  }
};
