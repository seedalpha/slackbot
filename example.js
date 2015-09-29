var Slack = require('./');
var through = require('through2').obj;
var slack = new Slack({ token: process.env.SLACK_TOKEN });

// slack.on('message', function(message) {
//   slack.sendIM(message.user, 'Hello back!');
// });

var stream = slack.stream();

stream.pipe(through(function(chunk, enc, cb) {
  this.push({
    type: 'result',
    args: [chunk.context.message.channel, 'Said: ' + chunk.message]
  });
  cb();
})).pipe(stream);