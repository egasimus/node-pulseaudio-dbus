module.exports = Object.create({

  addSignals: function (cls, signals) {
    cls.prototype._dbus.signals = signals;

    cls.prototype.on = function () {

      var
        signal   = arguments[0],
        callback = arguments[1];

      // If signal is an alias mapped in this._signals,
      // get its full name. Otherwise, use it as is.
      signal = (Object.keys(this._dbus.signals).indexOf(signal) >= 0)
        ? this._dbus.signals[signal]
        : signal;

      this.service.bus.signals.on(signal, callback);

      return this;
    };

    return cls;
  },

  addMethod: function (cls, iface, method, signature) {

    cls.prototype[method.charAt(0).toLowerCase() + method.slice(1)] = function () {
      var
        args     = Array.prototype.slice.apply(arguments),
        callback = (typeof(args[args.length - 1]) == "function") ? args.pop()
                                                                 : function() {},
        msg      = { path:        this.path,
                     interface:   iface,
                     member:      method };

      if (signature !== '') { msg.signature = signature;
                              msg.body      = args; }

      this.service.bus.invoke(msg, callback);
    }

  },

  addMethods: function (cls, ifaces) {

    cls.prototype._dbus.methods = ifaces;

    var self = this;
    Object.keys(ifaces).forEach( function(iface) {
      var methods = ifaces[iface];
      Object.keys(methods).forEach( function(method) {
        var signature = methods[method];
        self.addMethod(cls, iface, method, signature);
      } );
    } );
    return cls;

  },

  addProperties: function (cls, properties) {

    cls.prototype._dbus.properties = properties;

    var method = function (member, sig) {
      this.addMethod(cls, 'org.freedesktop.DBus.Properties', member, sig);
    }.bind(this);

    cls.prototype.get = function (iface, property, callback) {
      this.invoke(
        { interface:   'org.freedesktop.DBus.Properties',
          member:      'Get',
          signature:   'ss',
          body:        [iface, property] },
        callback ) };

    cls.prototype.set = function (iface, property, value, callback) {
      this.invoke(
        { interface:   'org.freedesktop.DBus.Properties',
          member:      'Set',
          signature:   'ssv',
          body:        [iface, property, value] },
        callback ) };

    cls.prototype.getAll = function (iface, property, callback) {
      this.invoke(
        { interface:   'org.freedesktop.DBus.Properties',
          member:      'Get',
          signature:   's',
          body:        [iface] },
        callback ) };

    return cls;

  },

  create: function (opts) {

    cls = opts.constructor || function () {};

    if (opts.prototype) cls.prototype = opts.prototype;
    cls.prototype._dbus = {};

    cls.prototype.invoke = function (options, callback) {
      if (!options.path) options.path = this.path;
      this.service.bus.invoke(options, callback);
    }

    if (opts.signals)    cls = this.addSignals(cls, opts.signals);
    if (opts.methods)    cls = this.addMethods(cls, opts.methods);
    if (opts.properties) cls = this.addProperties(cls, opts.properties);

    return cls;

  }

});
