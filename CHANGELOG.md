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

### v0.5.61
Fixes for regressions and gaps found in code review of the 0.5.59/0.5.60 optimistic-update work:
- Fix WyzeLockBoltV2 lock/unlock commands treating a resolved-but-logically-failed IoT3 response (`result.code !== "1"`) as success — this check was dropped when the command path became fire-and-forget; it's now restored and clears the grace period on failure so HomeKit doesn't keep showing a command that never applied
- Fix `refreshLockDevices` reusing `securityRefreshInterval` as both the fast-poll's own cadence and the "skip right after a full refresh" threshold — any config where `refreshInterval` <= `securityRefreshInterval` silently disabled lock fast-polling almost entirely; the skip window is now a fixed 10s constant, decoupled from user-configured intervals
- Add the same optimistic-update grace period used by locks to WyzeHMS (security panel) and to the on/off setter in WyzePlug/WyzeLight/WyzeMeshLight — without it, a poll landing mid-command could revert the optimistic state back to a stale/transitional value, reproducing the exact flicker bug the grace period was built to fix for locks
- Add a shared `armCommandGrace`/`clearCommandGrace`/`inCommandGrace` helper on the `WyzeAccessory` base class instead of copy-pasting the grace-period pattern into each accessory
- On command failure (reject or logical failure), clear the grace period immediately across WyzeLock, WyzeLockBoltV2, WyzeHMS, WyzePlug, WyzeLight, and WyzeMeshLight so the next poll can correct the optimistic state right away instead of waiting out the full 15s/90s window
- Fix WyzePlug/WyzeLight/WyzeMeshLight command errors being swallowed with `.catch(() => {})` and zero logging — errors are now logged when `pluginLoggingEnabled` is set, consistent with every other accessory
- Known limitation (not changed): the grace period can still mask a genuine physical/keypad lock change or a third-party app change that happens to match the pre-command state, for the duration of the window — this is an inherent trade-off of optimistic updates and isn't fixable without the Wyze API surfacing a freshness/version signal
- Reviewed but not changed: WyzeSwitch's `handleOnSetWallSwitch` has no grace period, so a failed command already self-corrects on the next full refresh (unlike the accessories above); the only gap is the removed `throw`, which is intentional per v0.5.59 (avoids putting the tile in a HAP error state)
- Reviewed but not changed: `runLockFastPollLoop`'s pre-existing `securityRefreshInterval || DEFAULT_SECURITY_REFRESH_INTERVAL` treats an explicit `0` as unset; this predates this diff and is left as-is

### v0.5.60
- Differentiate command grace period by direction: locking still uses a 15s grace window, but unlocking now uses 90s to match how long the Wyze API actually takes to propagate an unlock, preventing the fast poll from reverting the optimistic "unlocked" tile back to "locked" for WyzeLock and WyzeLockBoltV2
- Fix WyzeLock/WyzeLockBoltV2 `setLockTargetState` not updating `LockTargetState` alongside `LockCurrentState` on optimistic command updates
- Gate new lock timing/command-ack debug logs behind `pluginLoggingEnabled`, consistent with the rest of the plugin

### v0.5.59
- Eliminate "waiting" tile state on lock/unlock commands: `setLockTargetState` now updates HomeKit optimistically and fires the API call in the background for both WyzeLockBoltV2 (Palm Lock, Lock Bolt V2) and WyzeLock (YD.LO1)
- Add 15s command grace period on both lock types: fast poll skips updating lock state from the API during the grace window, preventing stale reads from reverting the optimistic HomeKit state before the Wyze API propagates
- Skip fast poll when a full refresh ran within the last 10s — prevents redundant back-to-back API polls and double full refreshes after a fast-poll-detected change
- Fix WyzeLock `updateCharacteristics` not pushing `LockTargetState` on physical lock/unlock — previously only `LockCurrentState` was updated, leaving HomeKit stuck in "waiting" after panel or physical state changes
- Fix WyzeHMS security panel "waiting": `handleSecuritySystemTargetStateSet` now updates `SecuritySystemCurrentState` optimistically and fires `setHMSState` in the background
- Optimistic on/off updates for WyzePlug, WyzeLight, WyzeMeshLight, and WyzeSwitch: setters update local state immediately and fire API calls in the background, eliminating HAP blocking
- Add change detection to WyzePlug, WyzeLight, and WyzeMeshLight `updateCharacteristics`: on/off state is only pushed to HomeKit when it differs from local state, preventing 60s refresh from flickering tiles whose state was just set
- WyzeSwitch: remove `throw` from `handleOnSetWallSwitch` error path — re-throwing caused HAP to put the tile in an error state; errors are now logged only
- Add dev-only startup log line showing plugin version when running from a local git clone

### v0.5.58
- Fix original Wyze Lock (YD.LO1) failing with `PARAM_SIGN_INVALID` / `PARAM_TIMESTAMP_INVALID` — bumps `wyze-api` to `1.1.14`, which corrects Ford API payload signing: signature is now computed after `access_token`, `key`, and `timestamp` are injected, and `getLockInfo` now sends signed parameters on the GET request. Lock Bolt V2, Lock Bolt Pro, and Palm Lock (IoT3 path) are unaffected.
- Closes #300

### v0.5.57
- Add `ModelNames` lookup table for cleaner device identification across all accessories
- Standardize log prefixes across all accessories for consistent log formatting
- Update README device list and add CONTRIBUTORS.md

### v0.5.56
- Remove `homebridge-config-ui-x` from plugin dependencies — it was never imported and caused install failures on Node.js 22/24 due to `node-pty` native bindings. Closes #286
- Reduce log noise: apply change-detection to all accessories so HomeKit characteristics are only updated when values actually change, eliminating redundant `[Wyze]` log lines on every poll
- Fix accessory routing regression — accessories were dispatching to the wrong handler after the 0.5.55 refactor
- Normalize all `noResponse` log messages to a consistent format across all accessories
- Fix four bugs identified in code review (null guards, incorrect characteristic references)
- Homebridge 1.x and 2.x compatibility verified

### v0.5.55
- Fix continuous Homebridge restart loop introduced in 0.5.54 — closes #295
- Add null guards for API responses across WyzeCamera, WyzeLight, WyzeMeshLight, WyzeLock, WyzeHMS, and WyzeThermostat to prevent `TypeError` crashes on transient Wyze API errors
- Wrap all `updateCharacteristics()` calls with `Promise.resolve().catch()` to prevent unhandled rejections from terminating the Homebridge process on Node.js 15+
- Add `default` branch to HMS state conversion to prevent undefined return

### v0.5.54
- Add Node.js 22 and 24 to supported engines — closes #281
- Pin `eslint` to v8 to satisfy `eslint-config-standard@17` peer dependency
- Bump `@typescript-eslint` to v8 for ESLint 9 compatibility

### v0.5.53
- First npm-published release via automated workflow
- Add Wyze Lock Bolt v2 (`DX_LB2`) support via IoT3 API — closes #285
- Add Palm Lock (`DX_PVLOC`) support via IoT3 API
- Add security fast-poll loop (10s) for locks — lock state changes reflect in HomeKit within 10 seconds
- Add `ChargingState` characteristic and firmware revision reporting to Lock Bolt V2
- Add live connectivity detection via `iot-state` in Lock Bolt V2
- Add humidity sensor, fan mode switch, emergency heat switch, hold mode switch, and keypad lock switch to thermostat
- Fix thermostat sub-services resolving to the same cached service on restart
- Fix WyzeHMS crash on offline
- Update `wyze-api` to 1.1.12

### v0.5.48
- Add security fast-poll loop (10s) for locks — lock state changes now reflect in HomeKit within 10 seconds instead of 60
- Add `lastDevice` caching to `WyzeAccessory` base class to support fast-poll without a full device list refresh
- Fix `WyzeLock` first-poll spurious full refresh by initializing state vars to `null`
- Refactor `WyzeLockBoltV2` to delegate IoT3 calls to `wyze-api` client (removes inline axios/crypto code)
- Add `ChargingState` characteristic to `WyzeLockBoltV2` battery service (`battery::power-source` confirmed as integer: 1=battery, 2=USB)
- Add firmware revision reporting to `WyzeLockBoltV2` via `device-info::firmware-ver`
- Add live connectivity detection via `iot-device::iot-state` in `WyzeLockBoltV2` (faster offline detection than `conn_state`)
- Add humidity sensor service to thermostat (surfaces `humidity` prop as `HumiditySensor`)
- Add fan mode switch to thermostat (on = continuous fan, off = auto)
- Add emergency heat switch to thermostat
- Add hold mode switch to thermostat
- Add keypad lock switch to thermostat
- Add read-only current scenario indicator to thermostat (reflects active schedule, snaps back if toggled)
- Fix thermostat Switch services to use `getServiceById` — prevents all sub-services resolving to the same cached service on restart
- Fix WyzeHMS crash on offline — `this.getCharacteristic` corrected to `this.securityService.getCharacteristic`
- Update wyze-api to 1.1.12 — includes bug fixes, lazy-load camera streaming, and removed moment dependency; if upgrading manually, run `npm install` or reinstall via the Homebridge UI to ensure the package is updated
- Remove unused dependencies: `moment`, `inherits`, `md5`, `uuid`; revert `homebridge-config-ui-x` to `^4.56.4`

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
