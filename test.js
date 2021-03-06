var PulseAudio = require('./lib/client');


var pulse = new PulseAudio.Core1();


var trace = function () { console.log("\nTRACE");
                          console.log(arguments); }


pulse.get('org.PulseAudio.Core1', 'Hostname', trace);


pulse.getPlaybackStreams(trace);


pulse.on(
  'NewPlaybackStream',
  function (path, args, sig) {
    var
      stream = pulse.getStream(
        args[0],
        function (err, stream) {

          stream.mute = false; 

          stream.get(
            'org.PulseAudio.Core1.Stream',
            'PropertyList',
            function (err, res)
            { console.log(res[1][0]) });

        });
  }
).on(
  'PlaybackStreamRemoved',
  trace
);
