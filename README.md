# This plugin adds support for Wyze Smart Home devices to [Homebridge](https://github.com/homebridge/homebridge).
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![certified-hoobs-plugin](https://badgen.net/badge/HOOBS/certified/yellow)](https://plugins.hoobs.org/plugin/homebridge-wyze-smart-home)
[![npm](https://img.shields.io/npm/dt/homebridge-wyze-smart-home)](https://www.npmjs.com/package/homebridge-wyze-smart-home)
[![npm](https://img.shields.io/npm/v/homebridge-wyze-smart-home.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-wyze-smart-home)
[![GitHub last commit](https://img.shields.io/github/last-commit/jfarmer08/homebridge-wyze-smart-home)](https://github.com/jfarmer08/homebridge-wyze-smart-home)
[![Chat](https://img.shields.io/discord/1134601590762913863)](https://discord.gg/Mjkpq2x9)

[![homebridge-wyze-smart-home: Wyze Connected Home plugin for Homebridge](https://github.com/jfarmer08/homebridge-wyze-smart-home/blob/main/logo.png?raw=true)](https://github.com/jfarmer08/homebridge-wyze-smart-home)

[Major Feature Backlog/Status](https://github.com/jfarmer08/homebridge-wyze-smart-home/discussions/224)


# Funding   [![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square&maxAge=2592000)](https://www.paypal.com/paypalme/AllenFarmer) [![Donate](https://img.shields.io/badge/Donate-Venmo-blue.svg?style=flat-square&maxAge=2592000)](https://venmo.com/u/Allen-Farmer) [![Donate](https://img.shields.io/badge/Donate-Cash_App-blue.svg?style=flat-square&maxAge=2592000)](https://cash.app/$Jfamer08)
If you like what I have done here and want to help I would recommend that you firstly look into supporting Homebridge. None of this could happen without them.

After you have done that if you feel like my work has been valuable to you I welcome your support through Paypal, Venmo or Cash App.

## Supported Devices
- Light Bulb (White, White V2)
- Light Strips (Light Strip, Light Strip Pro)
- Color Bulb (Mesh Light A19, BR30, A19 v2)
- Plug
- Outdoor Plug
- V1 & V2 Contact Sensor (Status / Battery)
- V1 & V2 Motion Sensor (Status / Battery)
- Temperature & Humidity Sensor (Status / Battery)
- Leak Sensor (Status / Battery)
- Lock (Battery / Door Status / Control)
- Lock Bolt v2 / Palm Lock (Battery / Door Status / Control)
- Camera v1, v2, v3, v3 Pro, v4 (on/off, Siren, Floodlight, Garage Door)
- Cam Pan, Pan v2, Pan v3 (on/off, Siren)
- Outdoor Cam, Outdoor Cam 2
- Wall Switch
- Home Monitoring System (HMS)
- Thermostat

## Not Yet Supported
The following Wyze products are recognized by the plugin but have no HomeKit support yet:
- Cameras: Battery Cam Pro, Cam OG, Cam OG Telephoto 3x, Cam Floodlight Pro, Cam Pan Pro
- Doorbells: Video Doorbell, Video Doorbell Pro, Video Doorbell Pro 2
- Plugs: Outdoor Plug (main unit)
- Sensors: Chime Sensor, Room Sensor (thermostat companion), Keypad
- Locks: Lock Bolt (original BLE-only version)
- Sprinkler Controller

The following newer Wyze products have no model codes in the plugin yet:
- Cam Pan v4, Bulb Cam, Window Cam, Battery Video Doorbell, Duo Cam Doorbell
- Lamp Socket / Lamp Socket v2, Night Light, Surge Protector

The following Wyze products are not applicable to HomeKit:
- Robot Vacuum, Cordless Vacuum, Scales, Watch, Headphones, Air Purifier

For more information about our version updates, please check our [change log](CHANGELOG.md).

## Configuration

Use the settings UI in Homebridge Config UI X to configure your Wyze account, or manually add the following to the platforms section of your config file:

```js
{
  "platforms": [
    {
      "platform": "WyzeSmartHome",
      "name": "Wyze",
      "username": "YOUR_EMAIL",
      "password": "YOUR_PASSWORD",
      "keyId": "",
      "apiKey": "",
      "hms": false,
      "lowBatteryPercentage": 30,
      "filterDeviceTypeList": ["OutdoorPlug","Plug"],
      "filterByMacAddressList": ["MAC_ADDRESS_1","MAC_ADDRESS_2"],
      "garageDoorAccessory": ["MAC_ADDRESS_1","MAC_ADDRESS_2"],
      "spotLightAccessory": ["MAC_ADDRESS_1","MAC_ADDRESS_2"],
      "floodLightAccessory": ["MAC_ADDRESS_1","MAC_ADDRESS_2"],
      "sirenAccessory": ["MAC_ADDRESS_1","MAC_ADDRESS_2"],
      "notificationAccessory": ["MAC_ADDRESS_1","MAC_ADDRESS_2"],
      "securityRefreshInterval": 10000
    }
  ]
}
```

Supported devices will be discovered and added to Homebridge automatically.

### Required Fields

* **`username`** &ndash; App email address
* **`password`** &ndash; App password
* **`apiKey`** &ndash; Navigate to [this portal](https://developer-api-console.wyze.com/)
* **`keyId`** &ndash; Navigate to [this portal](https://developer-api-console.wyze.com/), and click Login to sign in to your Wyze account.
Note: Ensure that the login info you are using matches the info you use when logLevel into the Wyze app.
Once you’ve signed in, you’ll be automatically redirected back to the developer page.
Click Create an API key for your API key to be created.
Once created, you can click view to see the entire key.
You should receive an email that a new API key has been generated.
Once you have the API key, you can use it in your script to get the access token and refresh token.

### Optional Fields

* **`hms`** &ndash; Set to `true` to enable the Home Monitoring System (HMS) gateway accessory. Defaults to `false`.
* **`refreshInterval`** &ndash; Defines how often the status of the devices will be polled in milliseconds (e.g., `"refreshInterval": 60000` will check the status of your devices' status every 60 seconds). Defaults to 60 seconds.
* **`phoneId`** &ndash; The phone id used by the Wyze App. This value is just found by intercepting your phone's traffic. If no `phoneId` is specified, a default value will be used.
* **`logLevel`** &ndash; If no `logLevel` is specified, a default value will be used.
* **`apiLogEnabled`** &ndash; If no `apiLogEnabled` is specified, a default value will be used.
* **`authApiKey`** &ndash; If no `authApiKey` is specified, a default value will be used.
* **`appName`** &ndash; If no `appName` is specified, a default value will be used.
* **`appVer`** &ndash; If no `appVer` is specified, a default value will be used.
* **`appVersion`** &ndash; If no `appVersion` is specified, a default value will be used.
* **`userAgent`** &ndash; If no `userAgent` is specified, a default value will be used.
* **`sc`** &ndash; If no `sc` is specified, a default value will be used.
* **`sv`** &ndash; If no `sv` is specified, a default value will be used.
* **`persistPath`** &ndash; If no `persistPath` is specified, a default value will be used.
* **`refreshTokenTimerEnabled`** &ndash; If no `refreshTokenTimerEnabled` is specified, a default value will be used.
* **`lowBatteryPercentage`** &ndash; Defines when to show devices with low battery (e.g., `"lowBatteryPercentage": 30`). Defaults to 30%.
* **`securityRefreshInterval`** &ndash; How often (in milliseconds) to fast-poll lock devices (Wyze Lock, Lock Bolt v2, Palm Lock) for state changes independently of the main refresh cycle (e.g., `"securityRefreshInterval": 10000`). Defaults to 10 seconds.
* **`pluginLoggingEnabled`** &ndash; Enables additional plugin-level debug logging, including lock fast-poll summaries. Defaults to false.

## Other Info

Special thanks to the following projects for reference and inspiration:

- [ha-wyzeapi](https://github.com/JoshuaMulliken/ha-wyzeapi), a Wyze integration for Home Assistant.
- [wyze-node](https://github.com/noelportugal/wyze-node), a Node library for the Wyze API.

Thanks to [misenhower](https://github.com/misenhower/homebridge-wyze-connected-home) for the original Wyze Homebridge plugin, and thanks to all [contributors](CONTRIBUTORS.md) who have volunteered their time to help fix bugs and add support for more devices and features.

This plugin is an actively maintained fork of misenhower's original [Wyze Homebridge Plugin](https://github.com/misenhower/homebridge-wyze-connected-home) project.
