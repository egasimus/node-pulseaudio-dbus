var net       = require('net'),
    dbus      = require('dbus-native'),
    handshake = require('dbus-native/lib/handshake'),
    events    = require('events');

var detect = require('./lib/detect'),
    client = require('./lib/client');

console.log("detect", detect.detectSync());

console.log("parse", detect.parse(detect.detectSync()));

console.log(client(detect.parse(detect.detectSync())));
