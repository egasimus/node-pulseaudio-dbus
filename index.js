var PulseAudio = require('./lib/client');


var pulse = new PulseAudio();


var trace = function () { console.log("\nTRACE");
                          console.log(arguments); }


pulse.get('org.PulseAudio.Core1', 'Hostname', function (err, res) { console.log(err, res) });


pulse.on(
  'NewPlaybackStream',
  function (path, args, sig) {
    var
      stream = pulse.getStream(
        args[0],
        function (err, res) {
          res.set('org.PulseAudio.Core1.Stream', 'Mute', ['b', 1], function () {});
        });
  }
).on(
  'PlaybackStreamRemoved',
  trace
);
