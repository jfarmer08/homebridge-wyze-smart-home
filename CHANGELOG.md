# homebridge-wyze-smart-home
# Funding   [![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square&maxAge=2592000)](https://www.paypal.com/paypalme/AllenFarmer)
If you like what I have done here and want to help I would recommend that you firstly look into supporting Homebridge. None of this could happen without them.

After you have done that if you feel like my work has been valuable to you I welcome your support through Paypal. All funding goes back into product purchases. I would love to support all products that Wyze has under their portfolio along with other product that gets rebranded for other companies.

## Releases

### v0.5.37-alpha.6
- Correct Mesh Brightness
- Correct camera offline

### v0.5.37-alpha.5
- Code Clean up
- Add Switch to turn on/off Notifications
- Correct Wall Switch Status
- Adjust Logging

### v0.5.37-alpha.4
- Add HL_A19C2
- Code clean up

### v0.5.37-alpha.3
- Fix issue with Light

### v0.5.37-alpha.2
- Add check box for HMS Subscription
- Removed MFA Support
- Correct Door State for Garage Door
- Code clean up

### v0.5.37-alpha.1
- Support for Siren
- Support for Garage Door
- Support for Spotlight
- Support for Floodlight

### v0.5.36
- Add HL_Cam3p to Approved List
- Require API Key and KeyID
- Add Info Logging

### v0.5.35
- Add loging to sub models

### v0.5.34
- Allow all sub models.

### v0.5.33
- Updated Thermostat behavior for single mode usage (heat/cool) (Thanks https://github.com/carTloyal123) - https://github.com/jfarmer08/homebridge-wyze-smart-home/issues/111

### v0.5.32
- Improve logging - https://github.com/jfarmer08/homebridge-wyze-smart-home/issues/117

### v0.5.31
- Improve Camera support - https://github.com/jfarmer08/homebridge-wyze-smart-home/issues/92

### v0.5.30
- HMS Code Clean up
- Update ReadME
- Update WyzeLeakSensor

### v0.5.29
- Support for API Key and Key ID
- Support for WYZECP1_JEF

### v0.5.28
- Correction for No-Response

### v0.5.26
- Release of Beta

### v0.5.25-beta.5
- Support for Thermostat
- Support for Wall Switch
- Support for HMS

### v0.5.25-dev.0
- Support for Thermostat
- Support for Wall Switch
- Support for HMS
### v0.5.25-beta.3
- Wall Switch Status update
- HMS
- Lock support is broken
### v0.5.25-beta.2
- Wall Switch was not status being followed
- Unable to turn Wall Switch On or Off.
- LOCK support is broken for this release
### v0.5.25-beta.1
- Wall Switch Support
- Lock changes - Reduce calls to wyze platform 
- Major Changes to SDK
- Initial support for Thermostat in SDK
- Initial support for HMS in SDK.

### v0.5.24
- Release

### v0.5.24-beta.1
- Filter Devices by Mac Address (Thanks https://github.com/kliu99)
- Filter Devices by Device Type
- Refresh refreshToken every 48 Hours
- Add Logging

### v0.5.24-beta.0
- Feature Support for ignoring devices
- Upate default refresh interval to 30 secounds
- Update grammer error

### v0.5.23
- Bug OutDoor Camera was not working with on/off
- Bug Wyze Doorbell does not support on/off

### v0.5.22
- Update NPM Version

### v0.5.21
- Battery Support for Locks
- Door Sensor from lock now being reported
- Update NPM Version
- Change Log Update

### v0.5.20
- Broke Offline Support

### v0.5.19
- Issue with Locks after adding Camera Support

### v0.5.18
- Initial Support for Camera on/off switch
- Code Clean up

### v0.5.17
- Initial Support for noResponse when device is offline. 
    ContactSensor v2
    LeakSensor v2
    Light Bulb
    Mesh Light Bulb
    Motion Sensor
    Plug
- Initial Support for Battery Level on Leak Sensor

### v0.5.15
- Bug Sensor can send a value greater then 100 for Battery Level
- v0.5.14 Initial Support for Battery level on Temperature Sensor
- v0.5.14 Initial Support for Battery level on v2 Contact Sensor
- v0.5.14 Initial Support for Battery level on v2 Motion Sensor
- v0.5.13 Fix issue with Temperature Sensor
- v0.5.12 Fix issue with Leak Sensor
- v0.5.11 Fix issue with Motion Sensor
- v0.5.10 Initial support for Wyze Temperature Sensor
- v0.5.10 Initial support for Wyze Leak Sensor
- v0.5.9 Initial support for Wyze Light Strips
- v0.5.9 Initial support for Wyze V2 Contact & Motion sensors
- v0.5.8 Fixed Bulbs not properly changing values when in a Scene with other Bulbs
- v0.5.8 Improved & streamlined logging (moved all status changes to Debug logs)
- v0.5.7 Initial support for the Wyze Lock
- v0.5.6 Initial support for new Wyze Color Bulbs
- v0.5.3 Improve logfile output for Bulb and Outdoor Plug
- v0.5.2 Added support for Wyze Outdoor Plug
- v0.5.1 Improve debug logging for Contact and Motion sensors.
- v0.5.0 Added support to Contact and Motion sensors
- v0.5.0 Added support to two factor authentication (2FA) via Authenticator app
- v0.4.1 Fix an issue that prevented the auto re-login from working
- v0.4.0 Add experimental support for the Wyze Bulb accessory
- v0.4.0 Set the homepage property
- v0.4.0 Improve logging to help diagnose occasional login issues
- v0.3.0 Add config schema for Homebridge Config UI X
- v0.2.0 Fix an issue caused by the Wyze API lagging behind updates
- v0.2.0 Fix description
- v0.2.0 Fix project link
- v0.1.0 Initial commit
