const fs = require('fs')
const path = require('path')
const net = require('net')

const DEFAULT_AUTH_BASE_URL = 'https://auth-prod.api.wyze.com'
const DEFAULT_API_BASE_URL = 'https://api.wyzecam.com'

const WYZE_ALLOWED_HOSTNAMES = new Set([
  new URL(DEFAULT_AUTH_BASE_URL).hostname,
  new URL(DEFAULT_API_BASE_URL).hostname
])

const SECRET_KEYS = [
  'username',
  'password',
  'mfaCode',
  'keyId',
  'apiKey',
  'authApiKey',
  'phoneId',
  'appName',
  'appVer',
  'appVersion',
  'userAgent',
  'sc',
  'sv',
  'fordAppKey',
  'fordAppSecret',
  'oliveSigningSecret',
  'oliveAppId',
  'appInfo'
]

const ENV_MAP = {
  username: 'WYZE_USERNAME',
  password: 'WYZE_PASSWORD',
  mfaCode: 'WYZE_MFA_CODE',
  keyId: 'WYZE_KEY_ID',
  apiKey: 'WYZE_API_KEY',
  authApiKey: 'WYZE_AUTH_API_KEY',
  phoneId: 'WYZE_PHONE_ID',
  appName: 'WYZE_APP_NAME',
  appVer: 'WYZE_APP_VER',
  appVersion: 'WYZE_APP_VERSION',
  userAgent: 'WYZE_USER_AGENT',
  sc: 'WYZE_SC',
  sv: 'WYZE_SV',
  fordAppKey: 'WYZE_FORD_APP_KEY',
  fordAppSecret: 'WYZE_FORD_APP_SECRET',
  oliveSigningSecret: 'WYZE_OLIVE_SIGNING_SECRET',
  oliveAppId: 'WYZE_OLIVE_APP_ID',
  appInfo: 'WYZE_APP_INFO'
}

function stripControlChars(input) {
  return String(input)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
}

function boundLength(input, maxLen) {
  const s = String(input)
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen) + '…'
}

function redactMacs(str) {
  return str.replace(/\b([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}\b/g, (mac) => {
    const parts = mac.split(':')
    return 'xx:xx:xx:xx:xx:' + parts[5]
  })
}

function redactBearerTokens(str) {
  return str.replace(/\bBearer\s+[-._~+/0-9a-zA-Z]+=*\b/g, 'Bearer [REDACTED]')
}

function redactEmails(str) {
  // Local part can be quite permissive (RFC 5321) but we keep the regex
  // conservative — anything with "@" and a TLD-shaped tail. Preserves first
  // letter so duplicate accounts can still be told apart in logs.
  return str.replace(
    /\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    (_m, first) => `${first}***@***`
  )
}

function redactGeo(str) {
  // 1) Lat/lon pairs in any common form. Conservative: only redact when both
  //    values land in plausible ranges, so we don't flag random floats.
  let out = str.replace(
    /(["']?)(lat(?:itude)?)(["']?\s*[:=]\s*)(-?(?:90(?:\.0+)?|[0-8]?\d(?:\.\d+)?))/gi,
    (_m, q1, name, sep) => `${q1}${name}${sep}[REDACTED_LAT]`
  )
  out = out.replace(
    /(["']?)(lon(?:gitude)?|lng)(["']?\s*[:=]\s*)(-?(?:180(?:\.0+)?|1[0-7]\d(?:\.\d+)?|[0-9]?\d(?:\.\d+)?))/gi,
    (_m, q1, name, sep) => `${q1}${name}${sep}[REDACTED_LON]`
  )
  // 2) "address": "...", "formatted_address": "..." — redact the value.
  out = out.replace(
    /(["']?)((?:formatted_)?address)(["']?\s*[:=]\s*)(["'])([^"']*)(["'])/gi,
    (_m, q1, name, sep, oq, _val, cq) => `${q1}${name}${sep}${oq}[REDACTED]${cq}`
  )
  return out
}

function redactKeyValueSecrets(str) {
  const keys = [
    'password',
    'apiKey',
    'keyId',
    'access_token',
    'refresh_token',
    'accessToken',
    'refreshToken',
    'authorization',
    'fordAppSecret',
    'fordAppKey',
    'oliveSigningSecret',
    'oliveAppId',
    'authApiKey'
  ]

  const keyGroup = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

  // Covers JSON-ish and plain logs like `password: ...` or `"password":"..."`
  const re = new RegExp(`(\\b(?:${keyGroup})\\b"?\\s*[:=]\\s*)("?)([^"\\s,}]+)("?)`, 'gi')
  return str.replace(re, (_m, prefix) => `${prefix}[REDACTED]`)
}

function sanitizeLogMessage(input) {
  let s = stripControlChars(input)
  s = redactBearerTokens(s)
  s = redactKeyValueSecrets(s)
  s = redactGeo(s)
  s = redactEmails(s)
  s = redactMacs(s)
  return boundLength(s, 2000)
}

function sanitizeDeviceName(name) {
  return boundLength(stripControlChars(name).trim(), 64) || 'Wyze Device'
}

function wrapLogger(log) {
  const callLevel = (level, args) => {
    const sanitizedArgs = args.map(sanitizeLogMessage)

    if (log && typeof log[level] === 'function') {
      return log[level](...sanitizedArgs)
    }

    if (typeof log === 'function') {
      return log(...sanitizedArgs)
    }
  }

  const wrapped = (...args) => callLevel('info', args)

  for (const level of ['error', 'warn', 'warning', 'info', 'debug']) {
    wrapped[level] = (...args) => callLevel(level === 'warning' ? 'warn' : level, args)
  }

  return wrapped
}

function loadSecretsFromFile(secretsFile) {
  // Reject any path that escapes the current working tree or is absolute —
  // prevents accidental loading of system files via misconfig.
  if (secretsFile.includes('..') || path.isAbsolute(secretsFile)) {
    throw new Error('Invalid file path')
  }
  const stat = fs.statSync(secretsFile)
  // Must not be readable/writable by group/others
  if ((stat.mode & 0o077) !== 0) {
    throw new Error(
      `Secrets file permissions too open: ${secretsFile}. ` +
        'Set mode to 600 (owner read/write only).'
    )
  }

  const raw = fs.readFileSync(secretsFile, 'utf8')
  const parsed = JSON.parse(raw)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

function resolveSecrets(config, log) {
  const merged = { ...config }

  if (config?.secretsFile) {
    try {
      const fromFile = loadSecretsFromFile(config.secretsFile)
      for (const k of SECRET_KEYS) {
        if (fromFile[k] != null && fromFile[k] !== '') merged[k] = fromFile[k]
      }
      log('Loaded secrets from secretsFile')
    } catch (e) {
      // Refuse to start: this prevents accidentally using a world-readable secrets file.
      log.error(`Failed to load secretsFile: ${e?.message || e}`)
      throw e
    }
  }

  for (const [key, envName] of Object.entries(ENV_MAP)) {
    const v = process.env[envName]
    if (v == null || v === '') continue

    if (key === 'appInfo') {
      try {
        merged.appInfo = JSON.parse(v)
      } catch {
        merged.appInfo = v
      }
      continue
    }

    merged[key] = v
  }

  return merged
}

function isIpLiteral(hostname) {
  return net.isIP(hostname) !== 0
}

function isClearlyLocalHostname(hostname) {
  const lower = String(hostname).toLowerCase()
  return (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local')
  )
}

function validateBaseUrl(urlString) {
  const u = new URL(urlString)
  if (u.protocol !== 'https:') {
    throw new Error(`Base URL must use https: ${urlString}`)
  }
  if (isIpLiteral(u.hostname)) {
    throw new Error(`IP literals are not allowed in base URLs: ${urlString}`)
  }
  if (isClearlyLocalHostname(u.hostname)) {
    throw new Error(`Local hostnames are not allowed in base URLs: ${urlString}`)
  }
  return u
}

function getValidatedBaseUrls(config, log) {
  const hasCustom = Boolean(config?.authBaseUrl || config?.apiBaseUrl)
  const allowCustom = Boolean(config?.dangerouslyAllowCustomBaseUrls)

  if (hasCustom && !allowCustom) {
    log.error(
      'Custom authBaseUrl/apiBaseUrl are ignored for security. ' +
        'If you understand the risks and still want this, set dangerouslyAllowCustomBaseUrls=true.'
    )
    return {
      authBaseUrl: DEFAULT_AUTH_BASE_URL,
      apiBaseUrl: DEFAULT_API_BASE_URL
    }
  }

  if (!hasCustom) {
    return {
      authBaseUrl: DEFAULT_AUTH_BASE_URL,
      apiBaseUrl: DEFAULT_API_BASE_URL
    }
  }

  // Custom base URLs only when explicitly opted-in.
  const authUrl = config.authBaseUrl ? validateBaseUrl(config.authBaseUrl) : new URL(DEFAULT_AUTH_BASE_URL)
  const apiUrl = config.apiBaseUrl ? validateBaseUrl(config.apiBaseUrl) : new URL(DEFAULT_API_BASE_URL)

  // Even when opted-in, refuse non-Wyze hosts.
  // Keeps the escape-hatch useful for path tweaks but blocks credential exfiltration / SSRF.
  if (!WYZE_ALLOWED_HOSTNAMES.has(authUrl.hostname) || !WYZE_ALLOWED_HOSTNAMES.has(apiUrl.hostname)) {
    throw new Error(
      `Custom base URL hostnames must be one of: ${Array.from(WYZE_ALLOWED_HOSTNAMES).join(', ')}. ` +
        'Refusing to start.'
    )
  }

  return {
    authBaseUrl: authUrl.toString().replace(/\/+$/, ''),
    apiBaseUrl: apiUrl.toString().replace(/\/+$/, '')
  }
}

module.exports = {
  DEFAULT_AUTH_BASE_URL,
  DEFAULT_API_BASE_URL,
  WYZE_ALLOWED_HOSTNAMES,
  sanitizeLogMessage,
  sanitizeDeviceName,
  wrapLogger,
  resolveSecrets,
  getValidatedBaseUrls
}
