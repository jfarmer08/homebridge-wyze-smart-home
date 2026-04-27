const { Service, Characteristic } = require("../types");
const WyzeAccessory = require("./WyzeAccessory");
const { propertyIds: PIDs } = require("wyze-api");

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class WyzeMeshLight extends WyzeAccessory {
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
    this.getCharacteristic(Characteristic.Hue).on(
      "set",
      this.setHue.bind(this)
    );
    this.getCharacteristic(Characteristic.Saturation).on(
      "set",
      this.setSaturation.bind(this)
    );

    // Local caching of HSV color space handling separate Hue & Saturation on HomeKit
    // Caching idea for handling HSV colors from:
    //    https://github.com/QuickSander/homebridge-http-rgb-push/blob/master/index.js
    this.cache = {};
    this.cacheUpdated = false;
  }

  async updateCharacteristics(device) {
    if (device.conn_state == 0) {
      this.getCharacteristic(Characteristic.On).updateValue(noResponse);
    } else {
      this.getCharacteristic(Characteristic.On).updateValue(
        device.device_params.switch_state
      );

      const propertyList = await this.plugin.client.getDevicePID(
        this.mac,
        this.product_model
      );
      for (const property of propertyList.data.property_list) {
        switch (property.pid) {
          case PIDs.BRIGHTNESS:
            if (this.isValidProperty(property)) this.updateBrightness(property.value);
            break;
          case PIDs.COLOR_TEMP:
            if (this.isValidProperty(property)) this.updateColorTemp(property.value);
            break;
          case PIDs.COLOR:
            if (this.isValidProperty(property)) this.updateColor(property.value);
            break;
        }
      }
    }
  }

  isValidProperty(property) {
    if (
        property.value != null &&
        property.value !== "0" &&
        property.value !== "undefi"
    ) {
      return true;
    } else {
      this.plugin.log(`Encountered invalid property value: ${JSON.stringify(property, null, 2)}`);
      return false;
    }
  }

  updateBrightness(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Updating brightness record for "${this.display_name} (${
          this.mac
        }) to ${value}: ${JSON.stringify(value)}"`
      );
    this.getCharacteristic(Characteristic.Brightness).updateValue(
      this.plugin.client.checkBrightnessValue(value)
    );
  }

  updateColorTemp(value) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Updating color Temp record for "${this.display_name} (${
          this.mac
        }) to ${value}: ${JSON.stringify(
          this.plugin.client.kelvinToMired(value)
        )}"`
      );
    this.getCharacteristic(Characteristic.ColorTemperature).updateValue(
      this.plugin.client.checkColorTemp(this.plugin.client.kelvinToMired(value))
    );
  }

  updateColor(value) {
    const { hue, saturation } = this.plugin.client.wyzeColorToHomeKit(value);
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Updating color record for "${this.display_name} (${
          this.mac
        }) to ${value}: hue=${hue} saturation=${saturation}"`
      );

    this.updateHue(hue);
    this.cache.hue = hue;

    this.updateSaturation(saturation);
    this.cache.saturation = saturation;
  }

  updateHue(value) {
    this.getCharacteristic(Characteristic.Hue).updateValue(value);
  }

  updateSaturation(value) {
    this.getCharacteristic(Characteristic.Saturation).updateValue(value);
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

  async setOn(value, callback) {
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Setting power for "${this.display_name} (${this.mac})" to ${value}"`
      );

    try {
      await this.plugin.client.lightMeshPower(
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
    if (this.plugin.config.pluginLoggingEnabled)
      this.plugin.log(
        `[MeshLight] Setting brightness for "${this.display_name} (${this.mac}) to ${value}"`
      );

    try {
      await this.plugin.client.setMeshBrightness(
        this.mac,
        this.product_model,
        value
      );
      callback();
    } catch (e) {
      callback(e);
    }
  }

  async setColorTemperature(value, callback) {
    if (value != null) {
      const wyzeValue = this.plugin.client.homeKitColorTempToWyze(value);
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[MeshLight] Setting color temperature for "${this.display_name} (${this.mac}) to ${value} : ${wyzeValue}"`
        );

      try {
        await this.plugin.client.setMeshColorTemperature(
          this.mac,
          this.product_model,
          wyzeValue
        );
        callback();
      } catch (e) {
        callback(e);
      }
    }
  }

  async setHue(value, callback) {
    if (value != null) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[MeshLight] Setting hue (color) for "${this.display_name} (${this.mac}) to ${value} : (H)S Values: ${value}, ${this.cache.saturation}"`
        );

      try {
        this.cache.hue = value;
        if (this.cacheUpdated) {
          const hexValue = this.plugin.client.homeKitColorToWyze(
            this.cache.hue,
            this.cache.saturation
          );
          if (this.plugin.config.pluginLoggingEnabled)
            this.plugin.log(hexValue);
          await this.plugin.client.setMeshHue(
            this.mac,
            this.product_model,
            hexValue
          );
          this.cacheUpdated = false;
        } else {
          this.cacheUpdated = true;
        }
        callback();
      } catch (e) {
        callback(e);
      }
    }
  }

  async setSaturation(value, callback) {
    if (value != null) {
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[MeshLight] Setting saturation (color) for "${this.display_name} (${this.mac}) to ${value}"`
        );
      if (this.plugin.config.pluginLoggingEnabled)
        this.plugin.log(
          `[MeshLight] H(S) Values: ${this.cache.saturation}, ${value}`
        );

      try {
        this.cache.saturation = value;
        if (this.cacheUpdated) {
          const hexValue = this.plugin.client.homeKitColorToWyze(
            this.cache.hue,
            this.cache.saturation
          );
          await this.plugin.client.setMeshSaturation(
            this.mac,
            this.product_model,
            hexValue
          );
          this.cacheUpdated = false;
        } else {
          this.cacheUpdated = true;
        }
        callback();
      } catch (e) {
        callback(e);
      }
    }
  }
};
