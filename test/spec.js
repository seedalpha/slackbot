var should = require('chai').should();
var Slack = require('../');



describe('Slackbot', function() {
  describe('constructor', function() {
    it('should create an instance', function() {
      Slack({ token: process.env.SLACK_TOKEN }).should.be.instanceof(Slack);
      (new Slack({ token: process.env.SLACK_TOKEN })).should.be.instanceof(Slack);
    })
  });

  describe('mock request', function() {
    it('should create and instance', function() {
      // var slack = Slack({ token: process.env.SLACK_TOKEN, mock: true }).stream();
      
    });
  });


  // simulate 
  //   slack.mock(JSON.stringify({
  //     channel: 'C123',
  //     type: 'message',
  //     text: 'Hello world',
  //     user: 'U123'
  //   }));


  // // payload should be string, JSON.parse(payload) should be object
  //   slack.on('mock:message', function(payload) {
  //     console.log(JSON.parse(payload));
  //   });
});