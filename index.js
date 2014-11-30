var
  net       = require('net'),
  dbus      = require('dbus-native'),
  handshake = require('dbus-native/lib/handshake'),
  events    = require('events');

var
  detect = require('./lib/detect'),
  Client = require('./lib/client');

var
  pulse = new Client(detect.parse(detect.detectSync()));

console.log("pulse", pulse);

console.log("iface", pulse.getInterface("org.PulseAudio.Core1"))
