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
        });
  }
).on(
  'PlaybackStreamRemoved',
  trace
);
