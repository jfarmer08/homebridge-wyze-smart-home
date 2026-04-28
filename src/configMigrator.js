"use strict";

/**
 * 2.0 config migration.
 *
 * The 1.x schema grew flat: ~25 top-level keys, five parallel per-camera
 * MAC arrays (garageDoorAccessory / spotLightAccessory / ...), two
 * exclude mechanisms (booleans + arrays), and three logging knobs
 * (apiLogEnabled / pluginLoggingEnabled / logLevel) that overlapped.
 *
 * 2.0 collapses all of that into a sectioned shape:
 *   {
 *     auth:     { username, password, keyId, apiKey, secretsFile? },
 *     polling:  { refreshInterval, lowBatteryPercentage },
 *     cameras:  [{ mac, name?, garage, spotlight, floodlight, siren, notifications }],
 *     thermostat: { exposeRoomSensors },
 *     hms:      { enabled },
 *     excludes: { macs: [], types: [] },
 *     logging:  { level, disableRedaction },
 *     advanced: { deviceTypeOverrides, dangerouslyAllowCustomBaseUrls, authBaseUrl, apiBaseUrl }
 *   }
 *
 * This module does two jobs:
 *
 *   1. `normalize(config)` — take whatever shape the user has on disk
 *      (1.x flat, 2.0 nested, or a mix) and return a single object with
 *      BOTH shapes populated. That way downstream code that still reads
 *      legacy field names (e.g. `config.pluginLoggingEnabled` in every
 *      accessory) keeps working unchanged while new code reads the
 *      nested fields.
 *
 *   2. `rewriteHomebridgeConfigOnDisk(...)` — find this plugin's entry
 *      in the user's homebridge config.json and rewrite it to the 2.0
 *      nested shape. Atomic, with a `.bak` next to the original. Only
 *      runs once — subsequent loads see the new shape and short-circuit.
 *
 * The on-disk rewrite is a UX optimization, not a correctness one. If
 * it fails for any reason (permissions, malformed JSON, can't find our
 * platform entry), normalize() still produces a working config from the
 * legacy fields and we log a warning telling the user to migrate by
 * hand. We never destructively modify a config we couldn't safely parse
 * back to the same shape.
 */

const fs = require("fs");
const path = require("path");

// ---- Helpers ---------------------------------------------------------------

const CAMERA_FEATURE_KEYS = [
  ["garage", "garageDoorAccessory"],
  ["spotlight", "spotLightAccessory"],
  ["floodlight", "floodLightAccessory"],
  ["siren", "sirenAccessory"],
  ["notifications", "notificationAccessory"],
];

const ADVANCED_KEYS = [
  "deviceTypeOverrides",
  "dangerouslyAllowCustomBaseUrls",
  "authBaseUrl",
  "apiBaseUrl",
];

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

// ---- normalize -------------------------------------------------------------

/**
 * Take a config of any shape and return one that has both the nested 2.0
 * fields and the legacy flat fields populated, so old and new code paths
 * both work. Returns a NEW object — input is not mutated.
 */
function normalize(input) {
  const c = { ...(input || {}) };

  // --- Auth ---
  const auth = isPlainObject(c.auth) ? c.auth : {};
  c.auth = {
    username: auth.username ?? c.username ?? "",
    password: auth.password ?? c.password ?? "",
    keyId: auth.keyId ?? c.keyId ?? "",
    apiKey: auth.apiKey ?? c.apiKey ?? "",
    secretsFile: auth.secretsFile ?? c.secretsFile ?? "",
    mfaCode: auth.mfaCode ?? c.mfaCode ?? "",
  };
  // Mirror to flat for legacy consumers.
  c.username = c.auth.username;
  c.password = c.auth.password;
  c.keyId = c.auth.keyId;
  c.apiKey = c.auth.apiKey;
  c.secretsFile = c.auth.secretsFile;
  c.mfaCode = c.auth.mfaCode;

  // --- Polling ---
  const polling = isPlainObject(c.polling) ? c.polling : {};
  c.polling = {
    refreshInterval: polling.refreshInterval ?? c.refreshInterval ?? 30000,
    lowBatteryPercentage: polling.lowBatteryPercentage ?? c.lowBatteryPercentage ?? 30,
  };
  c.refreshInterval = c.polling.refreshInterval;
  c.lowBatteryPercentage = c.polling.lowBatteryPercentage;

  // --- Cameras (per-MAC capability rows) ---
  // Build the unified array from whichever side has data.
  const cameraMap = new Map();
  if (Array.isArray(c.cameras)) {
    for (const cam of c.cameras) {
      if (!cam?.mac) continue;
      cameraMap.set(cam.mac, {
        mac: cam.mac,
        name: cam.name || "",
        garage: !!cam.garage,
        spotlight: !!cam.spotlight,
        floodlight: !!cam.floodlight,
        siren: !!cam.siren,
        notifications: !!cam.notifications,
      });
    }
  }
  for (const [feature, legacyKey] of CAMERA_FEATURE_KEYS) {
    const arr = Array.isArray(c[legacyKey]) ? c[legacyKey] : [];
    for (const mac of arr) {
      if (typeof mac !== "string" || !mac) continue;
      const row = cameraMap.get(mac) || {
        mac,
        name: "",
        garage: false, spotlight: false, floodlight: false, siren: false, notifications: false,
      };
      row[feature] = true;
      cameraMap.set(mac, row);
    }
  }
  c.cameras = Array.from(cameraMap.values());
  // Mirror back to legacy arrays so existing accessory code keeps working.
  for (const [feature, legacyKey] of CAMERA_FEATURE_KEYS) {
    c[legacyKey] = c.cameras.filter((cam) => cam[feature]).map((cam) => cam.mac);
  }

  // --- Thermostat ---
  const thermostat = isPlainObject(c.thermostat) ? c.thermostat : {};
  c.thermostat = {
    exposeRoomSensors: thermostat.exposeRoomSensors ?? c.enableThermostatRoomSensors ?? false,
  };
  c.enableThermostatRoomSensors = c.thermostat.exposeRoomSensors;

  // --- HMS ---
  const hmsBlock = isPlainObject(c.hms) ? c.hms : null;
  const hmsEnabled = hmsBlock ? !!hmsBlock.enabled : !!c.hms;
  c.hms = { enabled: hmsEnabled };
  // Some old code does `if (config.hms == false)` — keep a top-level
  // boolean alias so those checks still work.
  Object.defineProperty(c, "hmsEnabled", { value: hmsEnabled, enumerable: false });

  // --- Excludes ---
  const excludes = isPlainObject(c.excludes) ? c.excludes : {};
  const macs = Array.isArray(excludes.macs)
    ? excludes.macs
    : (c.excludeMacAddress && Array.isArray(c.filterByMacAddressList) ? c.filterByMacAddressList : []);
  const types = Array.isArray(excludes.types)
    ? excludes.types
    : (c.excludedeviceType && Array.isArray(c.filterDeviceTypeList) ? c.filterDeviceTypeList : []);
  c.excludes = { macs, types };
  c.filterByMacAddressList = macs;
  c.filterDeviceTypeList = types;
  // Legacy boolean toggles — derive from array contents so old checks still gate correctly.
  c.excludeMacAddress = macs.length > 0;
  c.excludedeviceType = types.length > 0;

  // --- Logging ---
  const logging = isPlainObject(c.logging) ? c.logging : {};
  // Resolution priority: nested level → flat logLevel → legacy apiLogEnabled boolean → default 'info'.
  let level = logging.level ?? c.logLevel;
  if (!level) level = c.apiLogEnabled ? "debug" : "info";
  level = String(level).toLowerCase();
  if (!["error", "warn", "info", "debug"].includes(level)) level = "info";

  c.logging = {
    level,
    disableRedaction: logging.disableRedaction ?? c.disableLogRedaction ?? false,
  };
  c.logLevel = level;
  c.disableLogRedaction = !!c.logging.disableRedaction;
  // Legacy boolean equivalents.
  c.apiLogEnabled = level === "debug";
  // pluginLoggingEnabled gates ~80 verbose log lines across accessory
  // files. Map it onto debug so users get the same behavior they used
  // to get from the standalone toggle without needing both knobs.
  c.pluginLoggingEnabled = level === "debug";

  // --- Advanced ---
  const advanced = isPlainObject(c.advanced) ? c.advanced : {};
  c.advanced = {};
  for (const k of ADVANCED_KEYS) {
    c.advanced[k] = advanced[k] ?? c[k];
    if (c.advanced[k] !== undefined) c[k] = c.advanced[k];
  }

  return c;
}

// ---- Build the canonical 2.0 shape for disk write -------------------------

/**
 * Project the normalized config down to the minimal 2.0 nested shape
 * (no legacy mirror fields). This is what we want sitting on disk.
 *
 * Drops empty optional fields so the saved file isn't cluttered with
 * keys the user never set.
 */
function toCanonical2x(normalized, platformMeta) {
  const out = {
    // Carry through homebridge platform identity.
    name: platformMeta.name || normalized.name || "Wyze",
    platform: platformMeta.platform || "WyzeSmartHome",

    auth: {
      username: normalized.auth.username,
      password: normalized.auth.password,
      keyId: normalized.auth.keyId,
      apiKey: normalized.auth.apiKey,
    },
    polling: {
      refreshInterval: normalized.polling.refreshInterval,
      lowBatteryPercentage: normalized.polling.lowBatteryPercentage,
    },
    cameras: normalized.cameras,
    thermostat: { exposeRoomSensors: normalized.thermostat.exposeRoomSensors },
    hms: { enabled: normalized.hms.enabled },
    excludes: { macs: normalized.excludes.macs, types: normalized.excludes.types },
    logging: {
      level: normalized.logging.level,
      disableRedaction: normalized.logging.disableRedaction,
    },
  };

  if (normalized.auth.secretsFile) out.auth.secretsFile = normalized.auth.secretsFile;
  if (normalized.auth.mfaCode) out.auth.mfaCode = normalized.auth.mfaCode;

  // Only include the advanced block if anything in it is set, so the
  // file stays clean for the 99% of users who never touch it.
  const advanced = {};
  for (const k of ADVANCED_KEYS) {
    const v = normalized.advanced?.[k];
    if (v == null) continue;
    if (typeof v === "object" && Object.keys(v).length === 0) continue;
    if (typeof v === "boolean" && v === false) continue;
    if (typeof v === "string" && v === "") continue;
    advanced[k] = v;
  }
  if (Object.keys(advanced).length > 0) out.advanced = advanced;

  return out;
}

// ---- isAlready2x ----------------------------------------------------------

/**
 * Detect whether a raw (pre-normalize) config is already in the 2.0
 * shape — meaning the on-disk rewrite has nothing to do.
 *
 * Heuristic: the nested blocks exist AND none of the legacy top-level
 * fields are present. We check for presence (not just truthiness) so a
 * deliberate `username: ""` in legacy form still triggers migration.
 */
function isAlready2x(raw) {
  if (!isPlainObject(raw)) return false;
  if (!isPlainObject(raw.auth)) return false;
  const legacyKeys = [
    "username", "password", "keyId", "apiKey",
    "garageDoorAccessory", "spotLightAccessory", "floodLightAccessory",
    "sirenAccessory", "notificationAccessory",
    "excludeMacAddress", "filterByMacAddressList",
    "excludedeviceType", "filterDeviceTypeList",
    "apiLogEnabled", "pluginLoggingEnabled", "showAdvancedOptions",
    "enableThermostatRoomSensors", "refreshInterval", "lowBatteryPercentage",
  ];
  return !legacyKeys.some((k) => Object.prototype.hasOwnProperty.call(raw, k));
}

// ---- rewriteHomebridgeConfigOnDisk ----------------------------------------

/**
 * Find our platform entry in homebridge's config.json and rewrite it to
 * the 2.0 nested shape. Atomic write with a `.bak` snapshot.
 *
 * Returns one of: "already-migrated" | "migrated" | "skipped:<reason>".
 *
 * Never throws — failures degrade gracefully (log + return reason). The
 * in-memory normalized config is what actually drives the running
 * plugin, so a failed disk rewrite means "users will see the old form
 * in the UI until they edit by hand," not "the plugin breaks."
 */
function rewriteHomebridgeConfigOnDisk({ configPath, platformAlias, log }) {
  let raw;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (e) {
    return `skipped:read-failed (${e.code || e.message})`;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    log?.warn?.(`[config] homebridge config.json is not valid JSON; skipping 2.0 auto-migration: ${e.message}`);
    return "skipped:parse-failed";
  }

  if (!Array.isArray(parsed.platforms)) return "skipped:no-platforms-array";

  // Find ALL entries matching our alias. If a user has multiple Wyze
  // platforms (rare but legal — different accounts), migrate each.
  const indices = [];
  parsed.platforms.forEach((p, i) => {
    if (p && (p.platform === platformAlias || p.platform === "WyzeSmartHome")) indices.push(i);
  });
  if (indices.length === 0) return "skipped:plugin-not-in-config";

  let migratedAny = false;
  for (const i of indices) {
    const original = parsed.platforms[i];
    if (isAlready2x(original)) continue;
    const normalized = normalize(original);
    parsed.platforms[i] = toCanonical2x(normalized, {
      name: original.name,
      platform: original.platform,
    });
    migratedAny = true;
  }

  if (!migratedAny) return "already-migrated";

  // Round-trip the new JSON before touching disk to make sure we
  // produce something parseable. Safety net against bugs in
  // toCanonical2x.
  const newJson = JSON.stringify(parsed, null, 4);
  try {
    JSON.parse(newJson);
  } catch (e) {
    log?.error?.(`[config] internal error: migrated config did not round-trip JSON; aborting disk rewrite (${e.message})`);
    return "skipped:roundtrip-failed";
  }

  // Write a .bak alongside the original so a worried user can roll back.
  const backupPath = `${configPath}.pre-2.0.bak`;
  try {
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, raw, { mode: 0o600 });
    }
  } catch (e) {
    log?.warn?.(`[config] could not write backup ${backupPath}; aborting auto-migration: ${e.message}`);
    return "skipped:backup-failed";
  }

  // Atomic write via temp + rename (same dir so it's always same fs).
  const tmpPath = path.join(path.dirname(configPath), `.${path.basename(configPath)}.wyze-migrate.tmp`);
  try {
    fs.writeFileSync(tmpPath, newJson, { mode: 0o600 });
    fs.renameSync(tmpPath, configPath);
  } catch (e) {
    log?.error?.(`[config] failed to write migrated config: ${e.message}`);
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return `skipped:write-failed (${e.code || e.message})`;
  }

  log?.warn?.(
    `[config] Migrated ${indices.length} Wyze platform entr${indices.length === 1 ? "y" : "ies"} ` +
    `in ${configPath} to the 2.0 nested shape. A backup of your previous config ` +
    `was saved to ${backupPath}. See the 2.0 release notes for the new structure.`
  );
  return "migrated";
}

module.exports = {
  normalize,
  toCanonical2x,
  isAlready2x,
  rewriteHomebridgeConfigOnDisk,
};
