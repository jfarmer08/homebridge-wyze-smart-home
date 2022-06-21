/* eslint-disable no-unused-vars */
const { v4: uuidv4 } = require('uuid')

// Here is where all the *magic* lives
const PHONE_SYSTEM_TYPE = '1'
const API_KEY = 'WMXHYf79Nr5gIlt3r0r7p9Tcw5bvs6BB4U8O8nGJ'
const APP_VERSION = '2.18.43'
const APP_VER = 'com.hualai.WyzeCam___2.18.43'
const APP_NAME = 'com.hualai.WyzeCam'
const PHONE_ID = (uuidv4().toString())
const APP_INFO = 'wyze_android_2.19.14' // Required for the thermostat
const SC = '9f275790cab94a72bd206c8876429f3c'
const SV = '9d74946e652647e9b6c9d59326aef104'

// Crypto secrets
const OLIVE_SIGNING_SECRET = 'wyze_app_secret_key_132' // Required for the thermostat
const OLIVE_APP_ID = '9319141212m2ik' // Required for the thermostat
const FORD_APP_KEY = '275965684684dbdaf29a0ed9' // Required for the locks
const FORD_APP_SECRET = '4deekof1ba311c5c33a9cb8e12787e8c' // Required for the locks

// Wyze urls
const AUTHBASEURL = 'https://auth-prod.api.wyze.com'
const APIBASEURL = 'https://api.wyzecam.com'
const WYZE_LOCK_CONTROL_URL = '/openapi/lock/v1/control'
const WYZE_LOCK_FULL_CONTROL_URL = 'https://yd-saas-toc.wyzecam.com/openapi/lock/v1/control'
const WYZE_REFRESH_TOKEN = 'app/user/refresh_token'
const WYZE_GET_OBJECT_LIST = 'app/v2/home_page/get_object_list'
const WYZE_GET_PROPERTY_LIST = 'app/v2/device/get_property_list'
const WYZE_SET_PROPERTY = 'app/v2/device/set_property'

// Wyze Shared Property Values
const WYZE_PROPERTY_NOTIFICATIONS = 'P1'
const WYZE_API_POWER_PROPERTY = 'P3'
const WYZE_PROPERTY_DEVICE_ONLINE = 'P5'

const WYZE_ACTION_POWER_ON = 'power_on'
const WYZE_ACTION_POWER_OFF = 'power_off'

const WYZE_PROPERTY_RSSI = 'P1612'
const WYZE_PROPERTY_VACATION_MODE = 'P1614'

const WYZE_PROPERTY_POWER_VALUE_ON = '1'
const WYZE_PROPERTY_POWER_VALUE_OFF = '0'
const WYZE_PROPERTY_DEVICE_ONLINE_VALUE_TRUE = '1'
const WYZE_PROPERTY_DEVICE_ONLINE_VALUE_FALSE = '0'
const WYZE_PROPERTY_DEVICE_VACATION_MODE_VALUE_TRUE = '1'
const WYZE_PROPERTY_DEVICE_VACATION_MODE_VALUE_FALSE = '0'

// Wyze Light
const WYZE_API_BRIGHTNESS_PROPERTY = 'P1501'
const WYZE_API_COLOR_TEMP_PROPERTY = 'P1502'

const WYZE_COLOR_TEMP_MIN = 2700
const WYZE_COLOR_TEMP_MAX = 6500
const HOMEKIT_COLOR_TEMP_MIN = 500
const HOMEKIT_COLOR_TEMP_MAX = 140

// Wyze Mesh Light
const WYZE_PROPERTY_BRIGHTNESS = 'P1501'
const WYZE_PROPERTY_COLOR_TEMP = 'P1502'
const WYZE_PROPERTY_MESH_LIGHT_RSSI = 'P1504'
const WYZE_PROPERTY_REMAING_TIME = 'P1505'
const WYZE_PROPERTY_MESH_LIGHT_VACATION_MODE = 'P1506'
const WYZE_PROPERTY_COLOR = 'P1507'
const WYZE_PROPERTY_COLOR_MODE = 'P1508'
const WYZE_PROPERTY_POWER_LOSS_RECOVERY = 'P1509'
const WYZE_PROPERTY_DELAY_OFF = 'P1510'

const WYZE_PROPERTY_COLOR_MODE_VALUE_CT = '2'
const WYZE_PROPERTY_COLOR_MODE_VALUE_RGB = '1'

const WYZE_API_COLOR_PROPERTY = 'P1507'

const WYZE_MESH_LIGHT_COLOR_TEMP_MIN = 1800
const WYZE_MESH_LIGHT_COLOR_TEMP_MAX = 6500

// Wyze Camera
const WYZE_ACTION_MOTION_ON = 'motion_alarm_on'
const WYZE_ACTION_MOTION_OFF = 'motion_alarm_off'
const WYZE_ACTION_FLOODLIGHT_ON = 'floodlight_on'
const WYZE_ACTION_FLOODLIGHT_OFF = 'floodlight_off'

const WYZE_PROPERTY_MOTION_RECORD = 'P1001'
const WYZE_PROPERTY_MOTION_NOTIFY = 'P1047'
const WYZE_PROPERTY_SOUND_NOTIFY = 'P1048'
const WYZE_PROPERTY_FLOODLIGHT = 'P1056'

const WYZE_PROPERTY_DEVICE_MOTION_RECORD_VALUE_TRUE = '1'
const WYZE_PROPERTY_DEVICE_MOTION_RECORD_VALUE_FALSE = '0'
const WYZE_PROPERTY_DEVICE_NOTIFICATIONS_VALUE_TRUE = '1'
const WYZE_PROPERTY_DEVICE_NOTIFICATIONS_VALUE_FALSE = '0'
const WYZE_PROPERTY_DEVICE_MOTION_NOTIFY_VALUE_TRUE = '1'
const WYZE_PROPERTY_DEVICE_MOTION_NOTIFY_VALUE_FALSE = '0'
const WYZE_PROPERTY_DEVICE_SOUND_NOTIFY_VALUE_TRUE = '1'
const WYZE_PROPERTY_DEVICE_SOUND_NOTIFY_VALUE_FALSE = '0'
const WYZE_PROPERTY_DEVICE_FLOODLIGHT_VALUE_ON = '1'
const WYZE_PROPERTY_DEVICE_FLOODLIGHT_VALUE_OFF = '2'
