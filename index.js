var
  net       = require('net'),
  dbus      = require('dbus-native'),
  handshake = require('dbus-native/lib/handshake'),
  events    = require('events');

var
  detect = require('./lib/detect'),
  Client = require('./lib/client');


var pulse = new Client();


console.log(pulse);


//console.log("iface", pulse.getInterface("org.PulseAudio.Core1"))
