# homebridge-wyze-smart-home
[![npm](https://img.shields.io/npm/dt/homebridge-wyze-smart-home)](https://www.npmjs.com/package/homebridge-wyze-smart-home)

This plugin adds support for Wyze Smart Home devices to [Homebridge](https://github.com/homebridge/homebridge).

This plugin is an actively maintained fork of misenhower's original [Wyze Homebridge Plugin](https://github.com/misenhower/homebridge-wyze-connected-home) project.

## Supported Devices
- Light Bulb
- Light Strips
- Color Bulb (Mesh Light)
- Plug
- Outdoor Plug
- V1 & V2 Contact Sensor
- V1 & V2 Motion Sensor
- Lock
- Tempeature Sensor
- Leak Sensor

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
      "mfaCode": "YOUR_2FA_AUTHENTICATION_PIN"
    }
  ]
}
```

Supported devices will be discovered and added to Homebridge automatically.

### Optional fields

* **`mfaCode`** &ndash; Only required for the initial login if you have two-factor authentication enabled for your account. This is typically a 6-digit code provided by your authenticator app.
* **`refreshInterval`** &ndash; Defines how often the status of the devices will be polled in milliseconds (e.g., `"refreshInterval": 5000` will check the status of your devices' status every 5 seconds). Defaults to 10 seconds.
* **`phoneId`** &ndash; The phone id used by the Wyze App. This value is just found by intercepting your phone's traffic. If no `phoneId` is specified, a default value will be used.

## Other Info

Special thanks to the following projects for reference and inspiration:

- [ha-wyzeapi](https://github.com/JoshuaMulliken/ha-wyzeapi), a Wyze integration for Home Assistant.
- [wyze-node](https://github.com/noelportugal/wyze-node), a Node library for the Wyze API.

Thanks to [misenhower](https://github.com/misenhower/homebridge-wyze-connected-home) for the original Wyze Homebridge plugin, and thanks to [contributors](https://github.com/misenhower/homebridge-wyze-connected-home/graphs/contributors) and [other developers who were not merged](https://github.com/misenhower/homebridge-wyze-connected-home/pulls) for volunteering their time to help fix bugs and add support for more devices and features.
