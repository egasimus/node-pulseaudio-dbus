var
  connect       = require('dbus-native'),

  meta          = require('./meta'),
  detect        = require('./detect'),
  PulseAudioBus = require('./bus'),

  PulseAudio    = module.exports = meta.create(function (params) {

    var params = params || { socket: detect.parse(detect.detectSync()) };

    this.name    = 'org.PulseAudio.Core1';
    this.service = { bus: new PulseAudioBus(connect(params)) };

    // Tell Pulse to send its signals our way.
    //for (var s in this._signals) {
      //var fullname = this._signals[s];
      //if (fullname.substring(0, "org.PulseAudio.".length) === "org.PulseAudio.") {
        //var split = fullname.split('.'),
            //name  = split[split.length - 1];
        //console.log("LISTEN", name);
        //this.listenForSignal(name, []);
      //}
    //}

    this.listenForSignal('', []);

    return this;

  }, {

    'org.freedesktop.DBus.Properties': {
      Get:    'ss',
      GetAll: 's',
      Set:    'ssv'
    },

    'org.PulseAudio.Core1': {
      GetCardByName:          's',
      GetSinkByName:          's',
      GetSourceByName:        's',
      GetSampleByName:        's',
      UploadSample:           'suuauau{say}ay',
      LoadModule:             's{ss}',
      Exit:                   '',
      ListenForSignal:        'sao',
      StopListeningForSignal: 's'
    }

  }, {

    NewPlaybackStream:     'org.PulseAudio.Core1.NewPlaybackStream',
    PlaybackStreamRemoved: 'org.PulseAudio.Core1.PlaybackStreamRemoved'

  });
