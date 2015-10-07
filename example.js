var Slack   = require('./');
var through = require('through2').obj;
var slack   = new Slack({ token: process.env.SLACK_TOKEN });

var stream = slack.stream();

// slack.on('init', function(data) {
//   console.log(data.channels);
// });

// stream.pipe(through(function(chunk, enc, cb) {
//   console.log(chunk);
//   cb();
// })).pipe(stream);

// stream.write(['C079895DW', 'Testing']);
// stream.on('data', function(chunk) {
//   console.log('data', chunk);
// });

// stream.pipe(through(function(chunk, enc, cb) {
//   if (chunk.type === 'presence_change' && chunk.user === slack.self().id) {
//     this.push(['test', 'I\'m back!']);
//   }
//   cb();
// })).pipe(stream);