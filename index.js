var PulseAudio = require('./lib/client');


var pulse = new PulseAudio();


var trace = function () { console.log(arguments); }


pulse.on(
  'NewPlaybackStream',
  function (path, args, sig) {
    var
      stream_path = args[0],
      stream      = pulse.service.bus.getObject(
        stream_path,
        'org.PulseAudio.Core1.Stream',
        function (err, res) {
          console.log(pulse)
          console.log(res);
          console.log("INVOKING");
          pulse.service.bus.invoke(
            { path:        res.service.name,
              interface:   'org.freedesktop.DBus.Properties',
              member:      'Set',
              signature:   'ssv',
              body:        ['org.PulseAudio.Core1.Stream',
                            'Mute', ['b', 1]] },
            function (err, res) {
              console.log(err, res)})
        });
  }
).on(
  'PlaybackStreamRemoved',
  trace
);
