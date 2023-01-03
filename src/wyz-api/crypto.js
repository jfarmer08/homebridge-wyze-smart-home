const md5 = require('md5')
const crypto = require('crypto')
const cryptojs = require('crypto-js')
const utf8 = require('utf8')

const constants = require('./constants')


    function fordCreateSignature(url_path, request_method, data) {
        var body = request_method + url_path;
        var keys = Object.keys(data).sort()
<<<<<<< HEAD
        for (const element of keys) { // now lets iterate in sort order
            var key = element;
=======
        for (var i = 0; i < keys.length; i++) { // now lets iterate in sort order
            var key = keys[i];
>>>>>>> reModel
            var value = data[key];
            body += key + '=' + value + '&';
        }
        const payload = body.slice(0, -1).concat(constants.fordAppSecret)
        var urlencoded = encodeURIComponent(payload)
        var en = crypto.createHash('md5').update(utf8.encode(urlencoded))
        var dig = en.digest('hex')
        return dig
    }

    function oliveCreateSignatureSingle(payload, access_token) {
        var access_key = access_token + constants.oliveSigningSecret
        var secret = crypto.createHash('md5').update(utf8.encode(access_key))
        var secrestDig = secret.digest('hex')
        var hmac = crypto.createHmac("md5", utf8.encode(secrestDig)).update(utf8.encode(payload), crypto.md5)
        var digest = hmac.digest('hex')
        return digest
    }

    function oliveCreateSignature(payload, access_token) {
        var body = '';
        var keys = Object.keys(payload).sort()
        for (var i = 0; i < keys.length; i++) { // now lets iterate in sort order
            var key = keys[i];
            var value = payload[key];
            body += key + '=' + String(value) + '&';
        }

        body = body.slice(0, -1)
        var access_key = access_token + constants.oliveSigningSecret
        var secret = crypto.createHash('md5').update(utf8.encode(access_key))
        var secrestDig = secret.digest('hex')
        var hmac = crypto.createHmac("md5", utf8.encode(secrestDig)).update(utf8.encode(body), crypto.md5)
        var digest = hmac.digest('hex')
        return digest
    }

    module.exports = {
        fordCreateSignature,
        oliveCreateSignatureSingle,
        oliveCreateSignature
    }