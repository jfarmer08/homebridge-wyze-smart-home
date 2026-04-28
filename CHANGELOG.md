# homebridge-wyze-smart-home

# Funding   [![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square&maxAge=2592000)](https://www.paypal.com/paypalme/AllenFarmer) [![Donate](https://img.shields.io/badge/Donate-Venmo-blue.svg?style=flat-square&maxAge=2592000)](https://venmo.com/u/Allen-Farmer) [![Donate](https://img.shields.io/badge/Donate-Cash_App-blue.svg?style=flat-square&maxAge=2592000)](https://cash.app/$Jfamer08)

If you like what I have done here and want to help I would recommend that you firstly look into supporting Homebridge. None of this could happen without them.

After you have done that if you feel like my work has been valuable to you I welcome your support through Paypal or other means. 

## Releases

### v2.0.0-beta.1

First 2.0 beta. Available on npm via `npm install homebridge-wyze-smart-home@beta` (or homebridge-config-ui-x → "Install Beta Version"). Stable users on the default `latest` tag are unaffected. Pairs with `wyze-api@2.0.0-beta.1`.

This is a large release — 73 commits since the last stable. Expect breaking changes (auto-migrated where possible) and lots of new behavior.

#### 🎥 Live HomeKit camera streaming

Cameras now appear as proper camera tiles with live video + audio, snapshots, and HomeKit's standard streaming UI — not just on/off switches.

- **Full HAP `CameraController` + SRTP**, Opus audio at 16/24 kHz.
- **Snapshot caching** — cloud thumbnail tried first, falls back to live WebRTC frame capture via bundled ffmpeg. 10s per-MAC cache so the Home app's frequent thumbnail requests don't hammer Wyze.
- **No system ffmpeg required** — `ffmpeg-static` ships the bundled binary.
- **External accessory publish** — cameras don't count against the ~150 bridge cap; each pairs independently with its own setup code. Switching from bridged to external is automatic on first 2.0 launch ("Migrating … from bridged to external — re-pair in Home app" log line per camera).
- **Resilient connection** — exponential-backoff reconnection on transient blips.
- **Compatible cameras**: V3, V4, V2, Pan v1/v2/v3/Pro, Outdoor / Outdoor 2, Doorbell / Pro / Pro 2, Floodlight / Floodlight Pro, Battery Cam Pro, OG / OG Telephoto 3x.
- **Per-camera capability switches** — garage door opener, spotlight, floodlight, siren, notifications, motion detection. All exposed as separate HomeKit accessories on the same camera.

#### 🆕 New accessory classes

- **`WyzeRoomSensor`** — Wyze Thermostat CO_TH1 room sensors. Discovered automatically via the Earth API when `thermostat.exposeRoomSensors: true`. One Temperature + Humidity tile per sensor.
- **`WyzeIrrigation`** — Wyze Sprinkler Controller (`BS_WK1`). One `Service.Valve` per zone with `ValveType.IRRIGATION` and `SetDuration`. Schedule via standard HomeKit automations.
- **`WyzeVacuum`** — Wyze Robot Vacuum (`JA_RO2`). `Service.Fan` (start/stop + suction speed) + `Service.Battery` (level + charging state). Optional per-room sweep switches (see below).

#### ✨ HomeKit visibility overhaul

The "no response" banner used to flicker on every accessory whenever Wyze had a brief hiccup. Replaced across the board:

- **`StatusActive` + `StatusFault` characteristics** on every accessory class. The Home app shows a small "inactive" or warning-triangle indicator instead of replacing the whole tile with a "no response" banner.
- **Last-known state stays visible** when the Wyze API goes silent — much friendlier than "...".
- **Cameras and locks** specifically no longer push `noResponse`; they keep the last good state with a fault indicator.

#### 💾 Persist last-known state across reboots

Every stateful accessory (Lock, LockBoltV2, Camera, Vacuum, Thermostat, Switch, HMS, RoomSensor, ContactSensor, MotionSensor, LeakSensor, TemperatureHumidity, Light, MeshLight, Plug) now writes its current state to disk and restores on next homebridge boot. No more "loading..." or default values for the first 30 seconds after restart — your switches are at the right state from the moment HomeKit asks.

State is flushed to disk after every state change (`api.updatePlatformAccessories()`), so a power loss mid-cycle doesn't lose more than the most recent change.

#### 📋 Config 2.0 nested shape (auto-migrated)

**No manual config edits required.** On first launch the plugin detects a 1.x flat config in `homebridge/config.json`, atomically rewrites it to the 2.0 nested shape, and saves a backup at `config.json.pre-2.0.bak`.

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

Sectioned UI replaces the single flat form gated on `showAdvancedOptions`. Cameras get a per-MAC table with capability checkboxes (was five parallel top-level MAC arrays).

#### 🎯 New per-accessory features

- **Per-camera Motion Detection switch** — toggles whether the camera looks for motion at all (distinct from Notifications). Lets users pause motion-driven HomeKit automation while keeping the camera powered on. (#231)
- **Per-room Robot Vacuum sweep switches** — opt-in via `vacuum.perRoomSwitches`. Adds one HomeKit Switch per room in the vacuum's current map. "Hey Siri, vacuum kitchen". (#274)
- **Thermostat heat-only / cool-only mode** — `thermostat.mode: "heat-only"` hides Cool + Auto in HomeKit; `"cool-only"` hides Heat + Auto. (#272)
- **Vacuum fault codes surfaced** — `fault_code: 514` ("Wheels stuck") etc. now show as `StatusFault.GENERAL_FAULT` (warning triangle) and log a warn line. Repeat-suppressed.
- **Vacuum suction speed** — exposed via `Service.Fan.RotationSpeed` (33/66/100 → STANDARD/STRONG/MAX).
- **`thermostat.exposeRoomSensors`** — opt-in CO_TH1 discovery via the Earth API; one extra call per thermostat per cycle.
- **`deviceTypeOverrides`** — route an unrecognized Wyze product code to an existing accessory class without waiting for a plugin release.

#### 🛡️ Security hardening

- **Log redaction**: bearer tokens, `access_token` / `refresh_token` / `password` / `apiKey` / GPS coordinates / street addresses / email addresses / MAC addresses are scrubbed from log output by default. Strips control chars and bounds line length.
- **Secrets file**: `auth.secretsFile` loads credentials from a mode-600 JSON file instead of `homebridge/config.json`. Refuses to load if file permissions are too open.
- **Base URL pinning**: refuses to use custom `authBaseUrl` / `apiBaseUrl` unless `dangerouslyAllowCustomBaseUrls: true`. Even then, only allowlisted Wyze hostnames are accepted.
- **Axios redirect guard**: any 3xx redirect to a non-Wyze host is refused. Prevents bearer-token leak via attacker-controlled redirect.
- **`logging.disableRedaction`** escape hatch — bypass scrubbing when capturing raw payloads for your own debugging. Off by default; never share resulting logs.

#### 🧹 Code cleanup

Every accessory class was refactored for consistency:
- Cleaner update flow (single `updateCharacteristics` per class), explicit per-PID mapping.
- Single update-line log per cycle (no more 5+ noisy lines per refresh).
- Error handling at the right boundary — async errors now surface to the caller instead of being silently swallowed.
- Dedupe of service-add boilerplate via `_getOrAddService` / `getBatteryService` helpers.
- API HomeKit conversion helpers used everywhere — bridge no longer reimplements converters from scratch (single source of truth in `wyze-api/src/shared/homekit.js`, kills the colorsys dep).

#### 🔧 Reliability fixes

- **HOOBS persist-dir `mkdir -p` fix** (#201, #236)
- **Refresh-token failure falls back to fresh login** (#258, #277)
- **Color-change crash loop fixed** (#251, #232)
- **Thermostat reboot-loop fixed** (#228)
- **Plugin-wide `unhandledRejection` + `uncaughtException` handlers** — a single bad accessory can no longer silently kill the homebridge child process.
- **Vacuum `lowBatteryPercentage`** — was hardcoded at `<20`; now honors the configured threshold.
- **Camera `device_params` guards** — `power_switch` and `privacySwitch` access no longer throws when `device_params` is missing.
- **Lock data guards** — protect against missing fields during initial connection.
- **HMS hub lookup hardened** — finds the first plan with a non-empty deviceList instead of indexing `[0]` blindly. Surfaces a clear error if no HMS subscription is active.
- **MeshLight subsection color** + **Light Strip Pro per-subsection colors** — closes long-standing color crash issues.

#### 🚀 Breaking changes

- **Cameras switch from bridged to external.** First 2.0 launch unregisters the bridged copy; re-pair each camera in the Home app to get the new external tile.
- **Config restructured** (auto-migrated; .bak saved).
- **`homebridge-config-ui-x` moved to `devDependencies`.** Was a runtime dep, which forced npm to compile `node-pty` during install — broke installs on Pi / arm64 / newer Node. End-user installs no longer touch node-pty. (#286, #281)
- **`engines.homebridge`** bumped to `^1.6.0 || ^2.0.0`. (#290)
- **`engines.node`** updated to `^18.20.4 || ^20.15.1 || ^22.0.0 || ^24`.
- **Logger format changed** to match Homebridge style (timestamp, cyan prefix, color-coded level tag). Legacy `apiLogEnabled` → maps to `debug`. New canonical control is `logging.level`.
- **Removed unused dependencies**: `aws-sdk`, `base64-js`, `colorsys`, `crypto-js`, `inherits`, `md5`, `moment`, `urllib`, `uuid` (the standalone one). Cleared two critical CVEs.
- **Comment-toggle requires removed.** `WyzeSmartHome.js` and `enums.js` no longer have "uncomment for release" gymnastics. Single canonical `require('wyze-api')` everywhere; dev mode uses `npm run dev-link` once after cloning.

#### 📦 Device support added / verified

Cameras (full live streaming + per-camera capability switches):
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
- Wyze Thermostat CO_TH1 Room Sensors

#### 🔍 Internal

- 178/178 wyze-api tests pass.
- Production npm audit: 13 → 4 issues. Both criticals cleared. Remaining 4 are the `werift` WebRTC chain.
- Two GitHub Actions workflows: `npm-publish-stable.yml` and `npm-publish-beta.yml`. Beta workflow auto-pins the `wyze-api` dep to the submodule version and verifies alignment.

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
