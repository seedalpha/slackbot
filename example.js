var Slack = require('./');
var through = require('through2').obj;
var slack = new Slack({ token: process.env.SLACK_TOKEN });

slack.on('message', function(message) {
  slack.sendIM(message.user, 'Hello back!');
});