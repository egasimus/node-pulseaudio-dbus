var addMethod = function (cls, iface, method, signature) {

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

};


var addMethods = function (cls, ifaces) {
  Object.keys(ifaces).forEach( function(iface) {
    var methods = ifaces[iface];
    Object.keys(methods).forEach( function(method) {
      var signature = methods[method];
      addMethod(cls, iface, method, signature);
    } );
  } );
};


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

module.exports = {
  addMethod:  addMethod,
  addMethods: addMethods
};
