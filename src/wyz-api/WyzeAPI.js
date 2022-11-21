const axios = require('axios')
const md5 = require('md5')
const fs = require('fs').promises
const path = require('path')
const { homebridge, UUIDGen } = require('../types')

const payloadFactory = require('./payloadFactory')

module.exports = class WyzeAPI {
  constructor (options, log) {
    this.log = log

    // User login parameters
    this.username = options.username
    this.password = options.password
    this.mfaCode = options.mfaCode

    // URLs
    this.authBaseUrl = options.authBaseUrl || 'https://auth-prod.api.wyze.com'
    this.apiBaseUrl = options.apiBaseUrl || options.baseUrl || 'https://api.wyzecam.com'

    // App emulation constants
    this.authApiKey = options.authApiKey || 'WMXHYf79Nr5gIlt3r0r7p9Tcw5bvs6BB4U8O8nGJ'
    this.phoneId = options.phoneId || 'bc151f39-787b-4871-be27-5a20fd0a1937'
    this.appName = options.appName || 'com.hualai.WyzeCam'
    this.appVer = options.appVer || 'com.hualai.WyzeCam___2.18.44'
    this.appVersion = options.appVersion || '2.18.44'
    this.appInfo = 'wyze_android_2.19.14' // Required for the thermostat
    this.sc = '9f275790cab94a72bd206c8876429f3c'
    this.sv = '9d74946e652647e9b6c9d59326aef104'
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Safari/605.1.15'

    // Crypto Secrets
    this.FORD_APP_KEY = '275965684684dbdaf29a0ed9' // Required for Locks
    this.FORD_APP_SECRET = '4deekof1ba311c5c33a9cb8e12787e8c' // Required for Locks
    this.OLIVE_SIGNING_SECRET = 'wyze_app_secret_key_132' // Required for the thermostat
    this.OLIVE_APP_ID = '9319141212m2ik' //  Required for the thermostat

    // Login tokens
    this.access_token = ''
    this.refresh_token = ''

    this.dumpData = false // Set this to true to log the Wyze object data blob one time at startup.
    // Token is good for 216,000 seconds (60 hours) but 48 hours seems like a reasonable refresh interval 172800
    setInterval(this.refreshToken.bind(this), 172800)
  }

  getRequestData (data = {}) {
    return {
      'access_token': this.access_token,
      'app_name': this.appName,
      'app_ver': this.appVer,
      'app_version': this.appVersion,
      'phone_id': this.phoneId,
      'phone_system_type': '1',
      'sc': this.sc,
      'sv': this.sv,
      'ts': (new Date).getTime(),
      ...data,
    }
  }

  async request (url, data = {}) {
    await this.maybeLogin()

    try {
      return await this._performRequest(url, this.getRequestData(data))
    } catch (e) {
      this.log.debug(e)
      if (this.refresh_token) {
        this.log.error('Error, refreshing access token and trying again')

        try {
          await this.refreshToken()
          return await this._performRequest(url, this.getRequestData(data))
        } catch (e) {
          //
        }
      }

      this.log.error('Error, logging in and trying again')

      await this.login()
      return this._performRequest(url, this.getRequestData(data))
    }
  }

  async _performRequest (url, data = {}, config = {}) {
    config = {
      method: 'POST',
      url,
      data,
      baseURL: this.apiBaseUrl,
      ...config
    }

    this.log.debug(`Performing request: ${url}`)
    this.log.debug(`Request config: ${JSON.stringify(config)}`)

    let result

    try {
      result = await axios(config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
      if (this.dumpData) {
        this.log.info(`API response: ${JSON.stringify(result.data)}`)
        this.dumpData = false // Only want to do this once at start-up
      }
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.error(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data)}`)
      }

      throw e
    }

    // Catch-all error message
    if (result.data.msg) {
      throw new Error(result.data.msg)
    }

    return result
  }

  _performLoginRequest (data = {}) {
    const url = 'user/login'

    data = {
      email: this.username,
      password: md5(md5(md5(this.password))),
      ...data
    }

    const config = {
      baseURL: this.authBaseUrl,
      headers: { 'x-api-key': this.authApiKey, 'User-Agent': this.userAgent }
    }

    return this._performRequest(url, data, config)
  }

  async login () {
    let result = await this._performLoginRequest()

    // Do we need to perform a 2-factor login?
    if (!result.data.access_token && result.data.mfa_details) {
      if (!this.mfaCode) {
        throw new Error('Your account has 2-factor auth enabled. Please provide the "mfaCode" parameter in config.json.')
      }

      const data = {
        mfa_type: 'TotpVerificationCode',
        verification_id: result.data.mfa_details.totp_apps[0].app_id,
        verification_code: this.mfaCode
      }

      result = await this._performLoginRequest(data)
    }

    await this._updateTokens(result.data)

    this.log.info('Successfully logged into Wyze API')
  }

  async maybeLogin () {
    if (!this.access_token) {
      await this._loadPersistedTokens()
    }

    if (!this.access_token) {
      await this.login()
    }
  }

  async refreshToken () {
    const data = {
      ...this.getRequestData(),
      refresh_token: this.refresh_token
    }

    const result = await this._performRequest('app/user/refresh_token', data)

    await this._updateTokens(result.data.data)
  }

  async _updateTokens ({ access_token, refresh_token }) {
    this.access_token = access_token
    this.refresh_token = refresh_token
    await this._persistTokens()
  }

  _tokenPersistPath () {
    const uuid = UUIDGen.generate(this.username)
    return path.join(homebridge.user.persistPath(), `wyze-${uuid}.json`)
  }

  async _persistTokens () {
    const data = {
      access_token: this.access_token,
      refresh_token: this.refresh_token
    }

    await fs.writeFile(this._tokenPersistPath(), JSON.stringify(data))
  }

  async _loadPersistedTokens () {
    try {
      let data = await fs.readFile(this._tokenPersistPath())
      data = JSON.parse(data)
      this.access_token = data.access_token
      this.refresh_token = data.refresh_token
    } catch (e) {
      //
    }
  }

  async getObjectList () {
    const result = await this.request('app/v2/home_page/get_object_list')

    return result.data
  }

  async getPropertyList (deviceMac, deviceModel) {
    const data = {
      device_mac: deviceMac,
      device_model: deviceModel
    }

    const result = await this.request('app/v2/device/get_property_list', data)

    return result.data
  }

  async setProperty (deviceMac, deviceModel, propertyId, propertyValue) {
    const data = {
      device_mac: deviceMac,
      device_model: deviceModel,
      pid: propertyId,
      pvalue: propertyValue
    }

    const result = await this.request('app/v2/device/set_property', data)

    return result.data
  }

  async runActionList (deviceMac, deviceModel, propertyId, propertyValue, actionKey) {
    // Wyze Color Bulbs use a new run_action_list endpoint instead of set_property
    const plist = [
      {
        pid: propertyId,
        pvalue: String(propertyValue)
      }
    ]
    if (propertyId !== 'P3') {
      plist.push({
        pid: 'P3',
        pvalue: '1'
      })
    }
    const innerList = [
      {
        mac: deviceMac,
        plist
      }
    ]
    const actionParams = {
      list: innerList
    }
    const actionList = [
      {
        instance_id: deviceMac,
        action_params: actionParams,
        provider_key: deviceModel,
        action_key: actionKey
      }
    ]
    const data = {
      action_list: actionList
    }
    this.log.debug(`run_action_list Data Body: ${JSON.stringify(data)}`)

    const result = await this.request('app/v2/auto/run_action_list', data)

    return result.data
  }

   async controlLock (deviceMac, deviceModel, action) {
    const path = '/openapi/lock/v1/control'
    
    let body = {}
    body["action"] = action
    body["uuid"] = this.getLockUuid(deviceMac, deviceModel)

    let result

    try {
      var payload = payloadFactory.ford_create_payload(this.accessToken, body, path, "post")

      result = await axios.post('https://yd-saas-toc.wyzecam.com/openapi/lock/v1/control', payload)
      this.log.debug(`API response: ${JSON.stringify(result.data, null, '\t')}`)
    } catch (e) {
      this.log.debug(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }
 // async controlLock (deviceMac, deviceModel, action) {
 //   const path = '/openapi/lock/v1/control'

 //   let body = {
 //     access_token: this.access_token,
 //     action: action,
 //     key: this.FORD_APP_KEY,
 //     timestamp: Date.now().toString(),
 //     uuid: this.getUuid(deviceMac, deviceModel)
 //   }
 
 //   body['sign'] = md5(encodeURIComponent(`post${path}${Object.keys(body).sort().map(key => `${key}=${body[key]}`).join('&')}${this.FORD_APP_SECRET}`))
//
 //   let result

   // try {
     // result = await axios.post('https://yd-saas-toc.wyzecam.com/openapi/lock/v1/control', body)
    //  this.log.debug(`API response: ${JSON.stringify(result.data, null, '\t')}`)
   // } catch (e) {
  //    this.log.debug(`Request failed: ${e}`)

    //  if (e.response) {
   //     this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
   //   }
//
  //    throw e
   // }
    // Lets only Return Data if we are in debug
   // return result.data
 // }

  getUuid (deviceMac, deviceModel) {
    return deviceMac.replace(`${deviceModel}.`, '')
  }
}
