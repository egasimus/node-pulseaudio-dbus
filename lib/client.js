var
  connect       = require('dbus-native'),

  meta          = require('./meta'),
  detect        = require('./detect'),
  PulseAudioBus = require('./bus'),

  Stream        = meta.create( {
  
    constructor: function (params) {
      console.log(params)
    },

    methods: {
      'org.freedesktop.DBus.Properties': {
        Get:    'ss',
        GetAll: 's',
        Set:    'ssv' },
    }

  }),

  Core1         = meta.create( {

    constructor: function (params) {

      var params = params || { socket: detect.parse(detect.detectSync()),
                               direct: true /* maybe used somewhere */ };

      this.name    = 'org.PulseAudio.Core1';
      this.path    = '/org/pulseaudio/core1';
      this.service = { bus: new PulseAudioBus(connect(params)) };
      this.listenForSignal('', []);


      return this;

    },

    prototype: {

      getObject: function (path, iface, callback) {
        this.service.bus.getObject(path, iface, function (err, res) {
          console.log("\nGOTTEN OBJECT", err, res);
          callback(err, res);
        });
      },

      getStream: function (path, callback) {
        this.getObject(path, 'org.PulseAudio.Core1.Stream', callback);
      }

    },

    properties: {

      'org.PulseAudio.Core1': {
        InterfaceRevision:   'u',
        Name:                's',
        Version:             's',
        IsLocal:             'b',
        Username:            's',
        Hostname:            's',
        DefaultChannels:     'au',
        DefaultSampleFormat: 'u',
        DefaultSampleRate:   'u',
        Cards:               'ao',
        Sinks:               'ao',
        FallbackSink:        'o',
        Sources:             'ao',
        FallbackSource:      'o',
        PlaybackStreams:     'ao',
        RecordStreams:       'ao',
        Samples:             'ao',
        Modules:             'ao',
        Clients:             'ao',
        MyClient:            'o',
        Extensions:          'as',
      }

    },

    methods: {

      'org.PulseAudio.Core1': {
        GetCardByName:          's',
        GetSinkByName:          's',
        GetSourceByName:        's',
        GetSampleByName:        's',
        UploadSample:           'suuauau{say}ay',
        LoadModule:             's{ss}',
        Exit:                   '',
        ListenForSignal:        'sao',
        StopListeningForSignal: 's',
      }

    },
    
    signals: {

      NewPlaybackStream:     'org.PulseAudio.Core1.NewPlaybackStream',
      PlaybackStreamRemoved: 'org.PulseAudio.Core1.PlaybackStreamRemoved'

    }

  } );

module.exports = Core1;
