const axios = require('axios')
const md5 = require('md5')
const fs = require('fs').promises
const path = require('path')
const { homebridge, UUIDGen } = require('../types')

const payloadFactory = require('./payloadFactory')
const crypto = require('./crypto')
const constants = require('./constants')

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
      this.log.error(e)
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
    await this.maybeLogin()
    var path = '/openapi/lock/v1/control'
    
    var payload = {
      "uuid": this.getUuid(deviceMac, deviceModel),
      "action": action  // "remoteLock" or "remoteUnlock"
  }

    let result

    try {
      payload = payloadFactory.fordCreatePayload(this.access_token, payload, path, "post")

      var urlPath = 'https://yd-saas-toc.wyzecam.com/openapi/lock/v1/control'
      result = await axios.post(urlPath, payload)
      this.log.debug(`API response: ${result.data}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async getLockInfo(deviceMac, deviceModel) {
    await this.maybeLogin()

    let result
    let url_path = "/openapi/lock/v1/info"

    let payload = {
      "uuid": this.getUuid(deviceMac, deviceModel),
      "with_keypad": '1'
  }
    try {      
      let config = {
        params: payload
      }  
      payload = payloadFactory.fordCreatePayload(this.access_token, payload, url_path, "get")

      const url = 'https://yd-saas-toc.wyzecam.com/openapi/lock/v1/info'
      result = await axios.get(url, config)
      this.log.debug(`API response: ${result.data}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)
      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async  getIotProp(deviceMac, keys) {
    await this.maybeLogin()
    let result
    var payload = payloadFactory.oliveCreateGetPayload(deviceMac, keys);
    var signature = crypto.oliveCreateSignature(payload, this.access_token);
    let config = {
      headers: {
        'Accept-Encoding': 'gzip',
        'User-Agent': this.userAgent,
        'appid': constants.oliveAppId,
        'appinfo': this.appInfo,
        'phoneid': this.phoneId,
        'access_token': this.access_token,
        'signature2': signature
      },
      params: payload
    }
    try {
      var url = 'https://wyze-sirius-service.wyzecam.com/plugin/sirius/get_iot_prop'
      this.log.debug(`Performing request: ${url}`)
      result = await axios.get(url, config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async setIotProp(deviceMac, product_model, propKey, value) {
    await this.maybeLogin()
    let result
    let payload = payloadFactory.oliveCreatePostPayload(deviceMac, product_model, propKey, value);
    let signature = crypto.oliveCreateSignatureSingle(JSON.stringify(payload), this.access_token);

      const config = {
        headers: {
          'Accept-Encoding': 'gzip',
          'Content-Type': 'application/json',
          'User-Agent': 'myapp',
          'appid': constants.oliveAppId,
          'appinfo': this.appInfo,
          'phoneid': this.phoneId,
          'access_token': this.access_token,
          'signature2': signature
        }
      }

    try {
      const url = 'https://wyze-sirius-service.wyzecam.com/plugin/sirius/set_iot_prop_by_topic'
      result = await axios.post(url, JSON.stringify(payload), config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async getUserProfile() {
    await this.maybeLogin()

    let payload = payloadFactory.oliveCreateUserInfoPayload();
    let signature = crypto.oliveCreateSignature(payload, this.access_token);

    let config = {
      headers: {
        'Accept-Encoding': 'gzip',
        'User-Agent': 'myapp',
        'appid': constants.oliveAppId,
        'appinfo': this.appInfo,
        'phoneid': this.phoneId,
        'access_token': this.access_token,
        'signature2': signature

      },
      params: payload
    }
    try {
      var url = 'https://wyze-platform-service.wyzecam.com/app/v2/platform/get_user_profile';
      this.log.debug(`Performing request: ${url}`)
      result = await axios.get(url, config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async disableRemeAlarm(hms_id) {
    await this.maybeLogin()

    let config = {
      headers: {
        'Authorization': this.access_token
      },
      payload: {
        'hms_id': hms_id,
        'remediation_id': 'emergency'
      }
    }
    try {
      const url = 'https://hms.api.wyze.com/api/v1/reme-alarm';
      this.log.debug(`Performing request: ${url}`)
      result = await axios.get(url, config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async getPlanBindingListByUser() {
    await this.maybeLogin()

    let payload = payloadFactory.oliveCreateHmsPayload()
    let signature = crypto.oliveCreateSignature(payload, this.access_token);
    let config = {
      headers: {
        'Accept-Encoding': 'gzip',
        'User-Agent': this.userAgent,
        'appid': constants.oliveAppId,
        'appinfo': this.appInfo,
        'phoneid': this.phoneId,
        'access_token': this.access_token,
        'signature2': signature
      },
      params: payload
    }

    try {
      const url = 'https://wyze-membership-service.wyzecam.com/platform/v2/membership/get_plan_binding_list_by_user';
      this.log.debug(`Performing request: ${url}`)
      result = await axios.get(url, config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async monitoringProfileStateStatus(hms_id) {
    await this.maybeLogin()

    let query = payloadFactory.oliveCreateHmsGetPayload(hms_id);
    let signature = crypto.oliveCreateSignature(query, this.access_token);

    let config = {
      headers: {
        'User-Agent': this.userAgent,
        'appid': constants.oliveAppId,
        'appinfo': this.appInfo,
        'phoneid': this.phoneId,
        'access_token': this.access_token,
        'signature2': signature,
        'Authorization': this.access_token,
        'Content-Type': 'application/json'
      },
      params: query
    }

    try {
      const url = 'https://hms.api.wyze.com/api/v1/monitoring/v1/profile/state-status'
      this.log.debug(`Performing request: ${url}`)
      result = await axios.get(url, config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  //Needs worked on
  async monitoringProfileActive(hms_id, home, away) {
    await this.maybeLogin()

    query = payloadFactory.oliveCreateHmsPatchPayload(hms_id);
    signature = crypto.oliveCreateSignature(query, this.access_token)
    let config = {
      headers: {
        'Accept-Encoding': 'gzip',
        'User-Agent': 'myapp',
        'appid': constants.oliveAppId,
        'appinfo': this.appinfo,
        'phoneid': this.phoneId,
        'access_token': this.access_token,
        'signature2': signature,
        'Authorization': this.access_token
      },
      params: [
        {
            "state": "home",
            "active": home
        },
        {
            "state": "away",
            "active": away
        }
     ],
      payload: query
    }

    try {
      const url = "https://hms.api.wyze.com/api/v1/monitoring/v1/profile/active";
      this.log.debug(`Performing request: ${url}`)
      result = await axios.patch(url, config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async thermostatGetIotProp(deviceMac, keys) {
    await this.maybeLogin()
    let result
    var payload = payloadFactory.oliveCreateGetPayload(deviceMac, keys);
    var signature = crypto.oliveCreateSignature(payload, this.access_token);
    let config = {
      headers: {
        'Accept-Encoding': 'gzip',
        'User-Agent': this.userAgent,
        'appid': constants.oliveAppId,
        'appinfo': this.appInfo,
        'phoneid': this.phoneId,
        'access_token': this.access_token,
        'signature2': signature
      },
      params: payload
    }
    try {
      var url = 'https://wyze-earth-service.wyzecam.com/plugin/earth/get_iot_prop'
      this.log.debug(`Performing request: ${url}`)
      result = await axios.get(url, config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  async thermostatSetIotProp(deviceMac,deviceModel, propKey, value) {
    await this.maybeLogin()

    let payload = payloadFactory.oliveCreatePostPayload(deviceMac, deviceModel, propKey, value);
    let signature = crypto.oliveCreateSignatureSingle(JSON.stringify(payload), this.access_token)

    const config = {
      headers: {
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'User-Agent': 'myapp',
        'appid': constants.oliveAppId,
        'appinfo': this.appInfo,
        'phoneid': this.phoneId,
        'access_token': this.access_token,
        'signature2': signature
      }
    }
    
    try {
      const url = 'https://wyze-earth-service.wyzecam.com/plugin/earth/set_iot_prop_by_topic';
      result = await axios.post(url, JSON.stringify(payload), config)
      this.log.debug(`API response: ${JSON.stringify(result.data)}`)
    } catch (e) {
      this.log.error(`Request failed: ${e}`)

      if (e.response) {
        this.log.info(`Response (${e.response.statusText}): ${JSON.stringify(e.response.data, null, '\t')}`)
      }
      throw e
    }
    return result.data
  }

  getUuid (deviceMac, deviceModel) {
    return deviceMac.replace(`${deviceModel}.`, '')
  }
}
