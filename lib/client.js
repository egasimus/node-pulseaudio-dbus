var
  constants     = require('dbus-native/lib/constants'),
  connect       = require('dbus-native'),
  EventEmitter  = require('events').EventEmitter,
  stdDbusIfaces = require('dbus-native/lib/stdifaces');


var
  detect = require('./detect');


module.exports = function (params) {
  var conn = connect(params || detect.parse(detect.detectSync()));
  this._bus = new PulseAudioBus(conn);

  var addMethod = function (name, signature) {
    this._addMethod('org.PulseAudio.Core1', name, signature)
  }.bind(this);

  console.log("foo", this._bus.signals);

  addMethod('ListenForSignal',        'sao');
  addMethod('StopListeningForSignal', 's');

  this.listenForSignal('', []);

  return this;
};


module.exports.prototype._addMethod = function(iface, method, signature) {
  name = method.charAt(0).toLowerCase() + method.slice(1);
  this[name] = function() {
    var
      args     = Array.prototype.slice.apply(arguments),
      callback = (typeof(args[args.length - 1]) == "function") ? args.pop() : function() {},
      msg      = { destination: 'org.PulseAudio.Core1',
                   path:        '/org/pulseaudio/core1',
                   interface:   iface,
                   member:      method };

    if (signature !== '') {
        msg.signature = signature;
        msg.body      = args;
    }

    console.log(msg);

    this._bus.invoke(msg, callback)
  }
};


var PulseAudioBus = function bus (conn) {
  if (!(this instanceof bus)) return new bus(conn);
  if (!conn) throw new Error("Can't connect to nowhere");

  var self = this;
  this.connection = conn;
  this.serial = 1;
  this.cookies = {}; // TODO: rename to methodReturnHandlers
  this.methodCallHandlers = {};
  this.signals = new EventEmitter();
  this.exportedObjects = {};

  // fast access to tree formed from object paths names
  // this.exportedObjectsTree = { root: null, children: {} };


  this.invoke = function(msg, callback) {
    if (!msg.type) msg.type = constants.messageType.methodCall;
    msg.serial = self.serial;
    self.serial++;
    this.cookies[msg.serial] = callback;
    self.connection.message(msg)};


  this.invokeDbus = function(msg, callback) {
    if (!msg.path) msg.path = '/org/freedesktop/DBus';
    if (!msg.destination) msg.destination = 'org.freedesktop.DBus';
    if (!msg['interface']) msg['interface'] = 'org.freedesktop.DBus';
    self.invoke(msg, callback)};


  this.mangle = function(path, iface, member) {
    var obj = {};
    if (typeof path === 'object') { // handle one argument case mangle(msg)
      obj.path      = path.path;
      obj.interface = path.interface;
      obj.member    = path.member;
    } else {
      obj.path      = path;
      obj.interface = iface;
      obj.member    = member;
    }
    return JSON.stringify(obj)};


  this.sendSignal = function(path, iface, name, signature, args) {
    var signalMsg = {
      type:      constants.messageType.signal,
      serial:    self.serial,
      interface: iface,
      path:      path,
      member:    name
    };
    if (signature) {
      signalMsg.signature = signature;
      signalMsg.body      = args;
    }
    self.connection.message(signalMsg)};


  this.sendError = function(msg, errorName, errorText) {
    var reply = { type:        constants.messageType.error,
                  replySerial: msg.serial,
                  destination: msg.sender,
                  errorName:   errorName,
                  signature:   's',
                  body:        [ errorText ] };
    //console.log('SEND ERROR', reply);
    this.connection.message(reply)};


  this.sendReply = function(msg, signature, body) {
    var reply = { type:        constants.messageType.methodReturn,
                  replySerial: msg.serial,
                  destination: msg.sender,
                  signature:   signature,
                  body:        body };
    this.connection.message(msg)};


  // route reply/error
  this.connection.on('message', function(msg) {

    var
      msg = JSON.parse(JSON.stringify(msg)),
      handler;

    if (msg.type == constants.messageType.methodReturn ||
        msg.type == constants.messageType.error) {

      handler = self.cookies[msg.replySerial];

      if (msg.type == constants.messageType.methodReturn && msg.body)
        msg.body.unshift(null); // first argument - no errors, null

      if (handler) {
        delete self.cookies[msg.replySerial];
        var props = { connection: self.connection,
                      bus:        self,
                      message:    msg,
                      signature:  msg.signature };
        if (msg.type == constants.messageType.methodReturn)
          handler.apply(props, msg.body); // body as array of arguments
        else handler.call(props, msg.body);  // body as first argument
      }

    } else if (msg.type == constants.messageType.signal) {

      self.signals.emit(self.mangle(msg), msg.body, msg.signature);

    } else { // methodCall

      // exported interfaces handlers
      var obj, iface, impl;
      if (obj = self.exportedObjects[msg.path]) {

        if (stdDbusIfaces(msg, self)) return;

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
          var resultSignature = iface[0].methods[msg.member][1];
          var reply = {
              type: constants.messageType.methodReturn,
              destination: msg.sender,
              replySerial: msg.serial
          };

          if (result) {
              reply.signature = resultSignature;
              reply.body = [result];
          }

          self.connection.message(reply);
          return;

        } else {

          console.error('Interface ' + msg['interface'] + ' is not supported');
          // TODO: respond with standard dbus error

        }

      }

      // setMethodCall handlers

      handler = self.methodCallHandlers[self.mangle(msg)];

      if (handler) {

        var result;

        try {
          result = handler[0].apply(null, msg.body);
        } catch (e) {
          console.error("Caught exception while trying to execute handler: ", e);
          self.sendError(e.message, e.description);
          return;
        }

        var reply = { type:        constants.messageType.methodReturn,
                      destination: msg.sender,
                      replySerial: msg.serial };

        if (result) {
          reply.signature = handler[1];
          reply.body = result;
        }

        self.connection.message(reply);

      } else {

         self.sendError(msg, 'org.freedesktop.DBus.Error.UnknownService', 'Uh oh oh');

      }

    }

  });


  this.setMethodCallHandler = function(objectPath, iface, member, handler) {
    var key = self.mangle(objectPath, iface, member);
    self.methodCallHandlers[key] = handler;
  };


  this.exportInterface = function(obj, path, iface) {
    var entry;

    if (!self.exportedObjects[path]) entry = self.exportedObjects[path] = {};
    else entry = self.exportedObjects[path];

    entry[iface.name] = [iface, obj];

    // monkey-patch obj.emit()

    if (typeof obj.emit === 'function' ) {
      var oldEmit = obj.emit;
      obj.emit = function() {

        var args = Array.prototype.slice.apply(arguments);
        var signalName = args[0];
        if (!signalName) throw new Error('Trying to emit undefined signa');

        //send signal to bus

        var signal;

        if (iface.signals && iface.signals[signalName]) {
          signal = iface.signals[signalName];
          //console.log(iface.signals, iface.signals[signalName]);
          var signalMsg = {
            type:      constants.messageType.signal,
            serial:    self.serial,
            interface: iface.name,
            path:      path,
            member:    signalName
          };
          if (signal[0]) {
            signalMsg.signature = signal[0];
            signalMsg.body      = args.slice(1);
          }
          self.connection.message(signalMsg);
          self.serial++;
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
      var introspect = require('./introspect.js');
      introspect(obj, function(err, ifaces) {
        if (err) return callback(err);
        obj.proxy = ifaces;
        callback(null, obj);
      });
    };

    this.getInterface = function(objName, ifaceName, callback) {
      //console.log(this);
      this.getObject(objName, function(err, obj) {
        if (err) return callback(err);
        callback(null, obj.as(ifaceName));
      });
    };
  }


  this.getService = function(name) {
      return new DBusService(name, this);
  };


  this.getObject = function(path, name, callback) {
     var service = this.getService(path);
     return service.getObject(name, callback);
  };


  this.getInterface = function(path, objname, name, callback) {
    return this.getObject(path, objname, function(err, obj) {
      if (err) return callback(err);
      callback(null, obj.as(name));
    });
  };

};
