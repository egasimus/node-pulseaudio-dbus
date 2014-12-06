var PulseAudio = require('./lib/client');


var pulse = new PulseAudio();


var trace = function () { console.log(arguments); }


pulse.on(
  'NewPlaybackStream',
  trace
).on(
  'PlaybackStreamRemoved',
  trace
);
