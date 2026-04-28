# homebridge-wyze-smart-home

# Funding   [![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square&maxAge=2592000)](https://www.paypal.com/paypalme/AllenFarmer) [![Donate](https://img.shields.io/badge/Donate-Venmo-blue.svg?style=flat-square&maxAge=2592000)](https://venmo.com/u/Allen-Farmer) [![Donate](https://img.shields.io/badge/Donate-Cash_App-blue.svg?style=flat-square&maxAge=2592000)](https://cash.app/$Jfamer08)

If you like what I have done here and want to help I would recommend that you firstly look into supporting Homebridge. None of this could happen without them.

After you have done that if you feel like my work has been valuable to you I welcome your support through Paypal or other means. 

## Releases

### v2.0.0-beta.1

First 2.0 beta. Available on npm via `npm install homebridge-wyze-smart-home@beta` (or homebridge-config-ui-x → "Install Beta Version"). Stable users on the default `latest` tag are unaffected. Pairs with `wyze-api@2.0.0-beta.1`.

#### Migrating from 1.x

**No manual config edits required.** On first launch, the plugin detects a 1.x flat config in your `homebridge/config.json`, atomically rewrites it to the 2.0 nested shape, and saves a backup at `config.json.pre-2.0.bak`. A single warn line in the log tells you when it happened. Re-running on already-migrated config is a no-op.

The new shape:

```jsonc
{
  "auth":     { "username", "password", "keyId", "apiKey", "secretsFile?" },
  "polling":  { "refreshInterval", "lowBatteryPercentage" },
  "cameras":  [{ "mac", "name?", "garage", "spotlight", "floodlight", "siren", "notifications", "motionDetection" }],
  "thermostat": { "exposeRoomSensors", "mode": "auto|heat-only|cool-only" },
  "vacuum":   { "perRoomSwitches" },
  "hms":      { "enabled" },
  "excludes": { "macs": [], "types": [] },
  "logging":  { "level": "error|warn|info|debug", "disableRedaction" },
  "advanced": { "deviceTypeOverrides", "dangerouslyAllowCustomBaseUrls", "authBaseUrl", "apiBaseUrl" }
}
```

#### Breaking

- **Config restructured.** Old top-level keys (`username`, `garageDoorAccessory`, `excludeMacAddress`, `apiLogEnabled`, `pluginLoggingEnabled`, etc.) are auto-migrated and back-filled in memory so all existing accessory code keeps working.
- **`homebridge-config-ui-x` moved to `devDependencies`.** Was a runtime dep, which forced npm to compile `node-pty` during install — broke installs on Pi / arm64 / newer Node. End-user installs no longer touch node-pty. (#286, #281)
- **`engines.homebridge`** bumped to `^1.6.0 || ^2.0.0`. (#290)
- **`engines.node`** updated to `^18.20.4 || ^20.15.1 || ^22.0.0 || ^24`. (#281)
- **Logger output format changed** to match Homebridge style (timestamp, cyan prefix, color-coded level tag). The legacy `apiLogEnabled` boolean still works but is deprecated in favor of `logging.level`.
- **Removed unused dependencies:** `aws-sdk`, `base64-js`, `colorsys`, `crypto-js`, `inherits`, `md5`, `moment`, `urllib`, `uuid` (the standalone one). Cleared two critical CVEs (`crypto-js` PBKDF2, `form-data` via `aws-sdk`).
- **Comment-toggle requires removed.** `WyzeSmartHome.js` and `enums.js` no longer have the "uncomment for release" gymnastics. Single canonical `require('wyze-api')` everywhere; dev mode uses `npm run dev-link` once after cloning to symlink the submodule.

#### New features

- **Sectioned 2.0 config UI.** Account / Polling / Cameras / Thermostat / Vacuum / HMS / Excludes / Logging / Advanced — replaces the single flat form gated on `showAdvancedOptions`. Cameras get a per-MAC table with capability checkboxes (was five parallel top-level MAC arrays).
- **Per-camera Motion Detection switch** — toggles whether the camera looks for motion at all, distinct from the Notifications switch. Lets users pause motion-driven HomeKit automation while keeping the camera powered on. (#231)
- **Per-room Robot Vacuum sweep switches** — opt-in via `vacuum.perRoomSwitches`. Adds one HomeKit Switch per room in the vacuum's current map, enabling voice control like "Hey Siri, vacuum kitchen". Uses Wyze's `vacuumSweepRooms(mac, [roomId])` endpoint. (#274)
- **Thermostat heat-only / cool-only mode** — `thermostat.mode: "heat-only"` hides Cool + Auto in HomeKit; `"cool-only"` hides Heat + Auto. Useful when the physical setup is one-sided (gas furnace, AC-only). (#272)
- **Vacuum fault codes surfaced.** `fault_code: 514` ("Wheels stuck") etc. now show as `StatusFault.GENERAL_FAULT` on the Fan tile (warning triangle in Home app) and log a warn-level line. Repeat-suppressed so the log doesn't fill up while the vacuum is stuck.
- **`logging.disableRedaction`** escape hatch — set true to bypass log scrubbing when capturing raw payloads for your own debugging. Off by default; tokens, credentials, GPS, emails, and MAC addresses are scrubbed.
- **`auth.secretsFile`** option — load credentials from a mode-600 JSON file instead of putting them in `homebridge/config.json`.

#### Reliability fixes

- **HOOBS persist-dir `mkdir -p` fix** — token persistence path is now `mkdir -p`'d before write. Was throwing ENOENT under HOOBS because the persist dir didn't exist; the plugin never recovered. (#201, #236)
- **Refresh-token failure falls back to fresh login** — when Wyze invalidates the refresh token early (which they do regularly), the plugin clears the dead tokens and re-logs-in with stored credentials transparently. No more crash loops or "Invalid Credentials" cascades. (#258, #277)
- **Color-change crash loop fixed** — `colorsys.hex2Hsv(null)` no longer takes down the plugin when Wyze returns a null/empty color value mid-state-change. (#251, #232)
- **Thermostat reboot-loop fixed** — the `device_params.temperature = ...` setter was crashing when Wyze returned a response without `device_params`. Refactored to store on the instance directly. (#228)
- **Plugin-wide unhandled-rejection / uncaught-exception handlers** — a single bad accessory can no longer silently kill the homebridge child process.
- **Vacuum `lowBatteryPercentage`** — was hardcoded at `<20`; now honors the configured threshold like every other battery accessory.
- **Axios redirect guard** — strict allowlist of Wyze hostnames; any 3xx redirect to a non-Wyze host is refused. Allowlist auto-derives from `*BaseUrl` constants in wyze-api so adding a new endpoint can't accidentally bypass it.

#### Device support added / verified

Cameras (all published as external accessories with live-stream + per-camera capability switches):
- Wyze Cam V4 (`HL_CAM4`) (#256)
- Wyze Battery Cam Pro (`AN_RSCW`) (#260)
- Wyze Cam Pan v3 (`HL_PAN3`) (#275)
- Wyze Cam Floodlight Pro (`LD_CFP`) (#276, #233)
- Wyze Cam OG (`GW_GC1`) + OG Telephoto 3x (`GW_GC`) (#278, #273)
- Plus the existing V3, V2, Pan v1/v2/Pro, Outdoor / Outdoor 2, Doorbell / Doorbell Pro / Doorbell Pro 2, Floodlight v1

Other:
- Palm Lock (`DX_PVLOC`) routed to the Lock Bolt V2 accessory class (#285)
- Robot Vacuum (`JA_RO2`) (#274)
- Sprinkler Controller (`BS_WK1`) (#282)

#### Internal

- 178/178 wyze-api tests pass.
- Production npm audit: 13 → 4 issues. Both criticals cleared (`crypto-js`, `form-data`). Remaining 4 are the `werift` WebRTC chain (transitive `ip` SSRF + `uuid` bounds); no upstream fix available, deferred.
- Two GitHub Actions workflows added: `npm-publish-stable.yml` (latest tag) and `npm-publish-beta.yml` (beta tag). Beta workflow auto-pins the `wyze-api` dep to the submodule version and verifies the api beta is published before publishing the bridge.

### v0.5.47
- Add Wyze Lock Bolt v2 (DX_LB2) support via IoT3 API
- Add Palm Lock (DX_PVLOC) support via IoT3 API
- Add WyzeCamV4 support
- Update axios to 1.7.4 for security improvements
- Fix color crashloop issue in camera v4

### v0.5.46
- Update thermostat structure to new format
- Update thermostat to have min/max thresholds closer to Wyze Thermostat thresholds -  https://github.com/jfarmer08/homebridge-wyze-smart-home/issues/203
- Update thermostat to avoid constant reboot -  https://github.com/jfarmer08/homebridge-wyze-smart-home/issues/228

### v0.5.45
- Increase Wyze-api Verison 1.0.7
- Update Logging

### v0.5.44
- Increase Wyze-api Version 1.0.5

### v0.5.43
- Increase Wyze-api Version 1.0.6

### v0.5.42
### v0.5.41
- Increase version of wyze-api 1.0.3

### v0.5.40
- Correct Outdoor Cam 2 model number

### v0.5.39
- Support for WyzeCamOutdoor2

### v0.5.38
- Resolve issues with API changes from Wyze (2024-02-01) by @hgoscenski in #3
- Format Code

### v0.5.37-alpha.7
- Remove Delay from MeshLight
- Format Code

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
