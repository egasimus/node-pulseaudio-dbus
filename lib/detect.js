var dbus    = require('dbus-native'),
    deasync = require('deasync');


var sessionBus = dbus.sessionBus(); // apparently this can be retrieved only once


var detect = function (callback) {
  var pa1 = sessionBus.getService('org.PulseAudio1');
  pa1.getInterface(
    '/org/pulseaudio/server_lookup1',
    'org.freedesktop.DBus.Properties',
    function (err, props) {
      if (err) {
        callback("Could not connect to PulseAudio lookup service.", null)
      } else {
        props.Get('org.PulseAudio.ServerLookup1', 'Address', callback)
      }})};


// TODO: figure out proper deasync wrapping.
var detectSync = function () {
  var address = null;
  detect(function(err, result){
    if (err) {
      address = false;
    } else {
      address = result[1][0];
    }
  });
  while (address === null) deasync.runLoopOnce();
  return address;
}


var parse = function (address) {

  console.log(address);

  var familyParams = address.split(':'),
      family       = familyParams[0],
      params       = {};

  familyParams[1].split(',').map(function(p) {
    var keyVal = p.split('=');
    params[keyVal[0]] = keyVal[1];
  });

  return params.path;
}


module.exports = {
  detect:     detect,
  detectSync: detectSync,
  parse:      parse
}
