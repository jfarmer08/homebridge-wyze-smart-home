const md5 = require('md5')
let constants = require('./constants')
let crypto = require('./crypto')


     
function fordCreatePayload(access_token, payload, url_path, request_method) {
    payload['accessToken'] = access_token
    payload['key'] = constants.fordAppKey
    payload['timestamp'] = Date.now().toString()
    payload['sign'] = crypto.fordCreateSignature(url_path, request_method, payload)
    return payload;
}

function oliveCreateGetPayload(device_mac, keys) {
    return {
        "keys": keys,
        "did": device_mac,
        "nonce": Date.now().toString()
    }
}

function oliveCreatePostPayload(device_mac, device_model, prop_key, value) {
    return {
        "did": device_mac,
        "model": device_model,
        "props": {
            [prop_key]: value
        },
        "is_sub_device": 0,
        "nonce": Date.now().toString()
    }
}

function oliveCreateHmsPayload() {
    return {
        "group_id": "hms",
        "nonce": Date.now().toString()
    }
}

function oliveCreateUserInfoPayload() {
    return {
        "nonce": Date.now().toString()
    }
}

function oliveCreateHmsGetPayload(hms_id) {
    return {
        "hms_id": hms_id,
        "nonce": Date.now().toString()
    }
}
function oliveCreateHmsPatchPayload(hms_id) {
    return {
        "hms_id": hms_id
    }
}

module.exports = {
    fordCreatePayload,
    oliveCreateGetPayload,
    oliveCreatePostPayload,
    oliveCreateHmsPayload,
    oliveCreateUserInfoPayload,
    oliveCreateHmsGetPayload,
    oliveCreateHmsPatchPayload
}