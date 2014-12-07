var
  connect       = require('dbus-native'),

  meta          = require('./meta'),
  detect        = require('./detect'),
  PulseAudioBus = require('./bus'),

  Stream        = meta.create( {
  
    constructor: function (params) {
      this.name    = params.name;
      this.path    = params.path;
      this.service = params.service;
    },

    prototype: {

      get mute () { return -1; },

      set mute (v) {
        this.set( 'org.PulseAudio.Core1.Stream', 'Mute',
                  ['b', v ? 1 : 0], function () {} ); },

      get volume () { return -1; },

      set volume(v) {
        this.set( 'org.PulseAudio.Core1.Stream', 'Volume',
                  ['au', [ [v] ]], function (err, res) {
                    console.log(err, res);
                  } ); },

      getVolume: function (callback) {
        this.get('org.PulseAudio.Core1.Stream',
                 'Volume', callback)}
    },

    properties: {
      'org.PulseAudio.Core1.Stream': {
        Index:          'u',
        Driver:         's',
        OwnerModule:    'o',
        Client:         'o',
        Device:         'o',
        SampleFormat:   'u',
        SampleRate:     'u',
        Channels:       'au',
        Volume:         'au', 
        VolumeWritable: 'b',
        Mute:           'b',
        BufferLatency:  't',
        DeviceLatency:  't',
        ResampleMethod: 's',
        PropertyList:   '{sab}',
      }
    },

    methods: {
      'org.PulseAudio.Core1.Stream': {
        Move: 'o',
        Kill: '',
      }
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
          res.path = path;
          callback(err, res)})},

      getStream: function (path, callback) {
        this.getObject(path, 'org.PulseAudio.Core1.Stream', function (err, res) {
          if (err) callback(err, null);
          callback(null, new Stream(res))})},

      getPlaybackStreams: function (callback) {
        this.get(
          'org.PulseAudio.Core1',
          'PlaybackStreams',
          function (err, res) {
            callback(err, res[1][0])})}

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

module.exports = {
  Core1:  Core1,
  Stream: Stream
};
