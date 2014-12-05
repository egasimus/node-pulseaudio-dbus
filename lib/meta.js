//var addMethod = function ;


//var addMethods = 


var addGetter = function (name) {

  this['get' + name] = function (path, callback) {
    this._bus.getObject(path, 'org.PulseAudio.Core1.' + name, callback);
  }

}


var addSingletonGetter = function (name, path) {

  this['get' + name] = function (callback) {
    this._bus.getObject(path, 'org.PulseAudio.Core1.' + name, callback);
  }

}

module.exports = Object.create({

  addMethod: function (cls, iface, method, signature) {

    cls.prototype[method.charAt(0).toLowerCase() + method.slice(1)] = function () {
      var
        args     = Array.prototype.slice.apply(arguments),
        callback = (typeof(args[args.length - 1]) == "function") ? args.pop()
                                                                 : function() {},
        msg      = { destination: 'org.PulseAudio.Core1',
                     path:        '/org/pulseaudio/core1',
                     interface:   iface,
                     member:      method };

      if (signature !== '') { msg.signature = signature;
                              msg.body      = args; }

      this._bus.invoke(msg, callback);
    }

  },

  addMethods: function (cls, ifaces) {
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

  addSignals: function (cls, signals) {
    cls.prototype._signals = signals;
    cls.prototype.on = function (signal, callback) {
      this._bus.signals.on(this._signals[signal], callback)
    };
    return cls;
  },

  create: function (cls, methods, signals) {
    cls = this.addMethods(cls, methods);
    cls = this.addSignals(cls, signals);
    return cls;
  }

});
