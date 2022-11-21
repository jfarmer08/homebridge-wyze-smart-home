const md5 = require('md5')
const crypto = require('./crypto')
const constants = require('./constants')

module.exports = class payloadFactory {

    ford_create_payload(access_token, data, url_path, request_method) {
        data["accessToken"] = access_token
        data["key"] = constants.FORD_APP_KEY
        data["timestamp"] = Date.now().toString()
        data["sign"] = wyzeCrypto.ford_create_signature(url_path, request_method, data)
        return data;
    }
    olive_create_get_payload(device_mac) {
        var nonce = Date.now()
        return {
            "keys": "trigger_off_val,emheat,temperature,humidity,time2temp_val,protect_time,mode_sys,heat_sp,cool_sp,current_scenario,config_scenario,temp_unit,fan_mode,iot_state,w_city_id,w_lat,w_lon,working_state,dev_hold,dev_holdtime,asw_hold,app_version,setup_state,wiring_logic_id,save_comfort_balance,kid_lock,calibrate_humidity,calibrate_temperature,fancirc_time,query_schedule",
            "did": device_mac,
            "nonce": nonce
        };
    }
    olive_create_post_payload(device_mac, device_model, prop, value) {
        var nonce = Date.now()
        return {
            "did": device_mac,
            "model": device_model,
            "props": {
                [prop.value]: value.toString()
            },
            "is_sub_device": 0,
            "nonce": nonce.toString()
        };
    }
    olive_create_hms_payload() {
        var nonce = Date.now()
        return {
            "group_id": "hms",
            "nonce": nonce.toString()
        };
    }

    olive_create_user_info_payload() {
        var nonce = Date.now()
        return {
            "nonce": nonce.toString()
        };
    }
    olive_create_hms_get_payload(hms_id) {
        var nonce = Date.now()
        return {
            "hms_id": hms_id,
            "nonce": nonce.toString()
        };
    }
    olive_create_hms_patch_payload(hms_id) {
        return {
            "hms_id": hms_id
        };
    }

}