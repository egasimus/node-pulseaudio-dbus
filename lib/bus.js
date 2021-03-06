var
  EventEmitter  = require('events').EventEmitter,

  constants     = require('dbus-native/lib/constants'),
  stdDbusIfaces = require('dbus-native/lib/stdifaces'),

  PulseAudioBus = module.exports = function bus (conn) {

    if (!(this instanceof bus)) return new bus(conn);
    if (!conn) throw new Error("Can't connect to nowhere");

    this.connection         = conn;
    this.serial             = 1;
    this.cookies            = {}; // TODO: rename to methodReturnHandlers
    this.methodCallHandlers = {};
    this.signals            = new EventEmitter();
    this.exportedObjects    = {};

    this.connection.on('message', this.onMessage.bind(this));
  };


PulseAudioBus.prototype.invoke = function(msg, callback) {
  if (!msg.type) msg.type = constants.messageType.methodCall;
  msg.serial = this.serial;
  this.serial++;
  this.cookies[msg.serial] = callback;
  this.connection.message(msg)
};


PulseAudioBus.prototype.invokeDbus = function(msg, callback) {
  if (!msg.path)         msg.path         = '/org/freedesktop/DBus';
  if (!msg.destination)  msg.destination  = 'org.freedesktop.DBus';
  if (!msg['interface']) msg['interface'] = 'org.freedesktop.DBus';

  this.invoke(msg, callback)
};


PulseAudioBus.prototype.mangle = function(msg) {
  return msg.iface + '.' + msg.member;
};


PulseAudioBus.prototype.sendSignal = function(path, iface, name, signature, args) {
  var signalMsg = { type:      constants.messageType.signal,
                    serial:    this.serial,
                    interface: iface,
                    path:      path,
                    member:    name };
  if (signature) {
    signalMsg.signature = signature;
    signalMsg.body      = args;
  }
  this.connection.message(signalMsg)
};


PulseAudioBus.prototype.sendError = function(msg, errorName, errorText) {
  var reply = { type:        constants.messageType.error,
                replySerial: msg.serial,
                destination: msg.sender,
                errorName:   errorName,
                signature:   's',
                body:        [ errorText ] };
  this.connection.message(reply)
};


PulseAudioBus.prototype.sendReply = function(msg, signature, body) {
  var reply = { type:        constants.messageType.methodReturn,
                replySerial: msg.serial,
                destination: msg.sender,
                signature:   signature,
                body:        body };
  this.connection.message(msg)
};


PulseAudioBus.prototype.onMessage = function(msg) {
  var msg     = JSON.parse(JSON.stringify(msg)),
      msgType = constants.messageType,
      handler = (msg.type == msgType.methodReturn ||
                 msg.type == msgType.error)  ? this.onMethodReturnOrError :
                (msg.type == msgType.signal) ? this.onSignal
                                             : this.onMethodCall;

  (handler.bind(this))(msg);
};


PulseAudioBus.prototype.onMethodReturnOrError = function (msg) {
  var handler = this.cookies[msg.replySerial];

  if (msg.type == constants.messageType.methodReturn && msg.body)
    msg.body.unshift(null); // first argument - no errors, null

  if (handler) {
    delete this.cookies[msg.replySerial];
    var props = { connection: this.connection,
                  bus:        this,
                  message:    msg,
                  signature:  msg.signature };
    if (msg.type == constants.messageType.methodReturn)
      handler.apply(props, msg.body); // body as array of arguments
    else handler.call(props, msg.body);  // body as first argument
  }
};


PulseAudioBus.prototype.onSignal = function (msg) {
  this.signals.emit(
    this.mangle({iface:  msg.interface,
                 member: msg.member}),
    msg.path, msg.body, msg.signature);
};


PulseAudioBus.prototype.onMethodCall = function (msg) {

  // exported interfaces handlers

  var obj, iface, impl;

  if (obj = this.exportedObjects[msg.path]) {

    if (stdDbusIfaces(msg, this)) return;

    if (iface = obj[msg['interface']]) {

      // now we are ready to serve msg.member
      impl = iface[1];
      var func = impl[msg.member];

      if (!func) {
        // TODO: respond with standard dbus error
        console.error('Method ' + msg.member + ' is not implemented ');
        throw new Error('Method ' + msg.member + ' is not implemented ');
      };

      try {
        result = func.apply(impl, msg.body);
      } catch (e) {
        console.error("Caught exception while trying to execute handler: ", e);
        throw e;
      }

      // TODO safety check here
      var resultSignature = iface[0].methods[msg.member][1],
          reply           = { type: constants.messageType.methodReturn,
                              destination: msg.sender,
                              replySerial: msg.serial };

      if (result) {
          reply.signature = resultSignature;
          reply.body = [result];
      }

      this.connection.message(reply);
      return;

    } else {

      console.error('Interface ' + msg['interface'] + ' is not supported');
      // TODO: respond with standard dbus error

    }

  }

  // setMethodCall handlers

  var handler = this.methodCallHandlers[this.mangle(msg)];

  if (handler) {

    var result;

    try {
      result = handler[0].apply(null, msg.body);
    } catch (e) {
      console.error("Caught exception while trying to execute handler: ", e);
      this.sendError(e.message, e.description);
      return;
    }

    var reply = { type:        constants.messageType.methodReturn,
                  destination: msg.sender,
                  replySerial: msg.serial };

    if (result) {
      reply.signature = handler[1];
      reply.body = result;
    }

    this.connection.message(reply);

  } else {

     this.sendError(msg, 'org.freedesktop.DBus.Error.UnknownService', 'Uh oh oh');

  }

}


PulseAudioBus.prototype.setMethodCallHandler = function(objectPath, iface, member, handler) {
  var key = this.mangle({path:   objectPath,
                         iface:  iface,
                         member: member});
  this.methodCallHandlers[key] = handler;
};


PulseAudioBus.prototype.exportInterface = function(obj, path, iface) {
  var entry;

  if (!this.exportedObjects[path]) entry = this.exportedObjects[path] = {};
  else entry = this.exportedObjects[path];

  entry[iface.name] = [iface, obj];

  // monkey-patch obj.emit()

  if (typeof obj.emit === 'function' ) {
    var oldEmit = obj.emit;
    obj.emit = function() {

      var args = Array.prototype.slice.apply(arguments);
      var signalName = args[0];
      if (!signalName) throw new Error('Trying to emit undefined signal');

      //send signal to bus

      var signal;

      if (iface.signals && iface.signals[signalName]) {
        signal = iface.signals[signalName];
        //console.log(iface.signals, iface.signals[signalName]);
        var signalMsg = {
          type:      constants.messageType.signal,
          serial:    this.serial,
          interface: iface.name,
          path:      path,
          member:    signalName
        };
        if (signal[0]) {
          signalMsg.signature = signal[0];
          signalMsg.body      = args.slice(1);
        }
        this.connection.message(signalMsg);
        this.serial++;
      }

      // note that local emit is likely to be called
      // before signal arrives to remote subscriber

      oldEmit.apply(obj, args);
    };
  }

  // TODO: emit ObjectManager's InterfaceAdded
};


function DBusObject(name, service) {
  this.name    = name;
  this.service = service;
  this.as      = function(name) { return this.proxy[name] }
};


function DBusService(name, bus) {
  this.name = name;
  this.bus = bus;
  this.getObject = function(name, callback) {
    var obj = new DBusObject(name, this);
    callback(null, obj);
  };

  this.getInterface = function(objName, ifaceName, callback) {
    //console.log(this);
    this.getObject(objName, function(err, obj) {
      if (err) return callback(err);
      callback(null, obj.as(ifaceName));
    });
  };
}


PulseAudioBus.prototype.getService = function(name) {
    return new DBusService(name, this);
};


PulseAudioBus.prototype.getObject = function(path, name, callback) {
   var service = this.getService(path);
   return service.getObject(name, callback);
};


PulseAudioBus.prototype.getInterface = function(path, objname, name, callback) {
  return this.getObject(path, objname, function(err, obj) {
    if (err) return callback(err);
    callback(null, obj.as(name));
  });
};

