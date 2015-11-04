var should = require('chai').should();
var Slack = require('../');



describe('Slackbot', function() {
  describe('init Slack mock', function() {
    beforeEach(function() {
      this.slack = new Slack({ mock: true });
      this.slack.on('mock:request', function(data) {
        // console.log(data);
        if (data.method === 'chat.postMessage') {
          var message = JSON.parse(data.data);

          data.callback(null, { ok: true, channel: '', type: 'message', message: {
            text: message.text,
            attachments: message.attachments
          }})
        } else {
          data.callback(null, { url: '', users: [{ id: 'U123' }], channels: [], groups: [], ims: [{ id: 'D123', user: 'U123'}] , self: {} });
        }
      });
    })

    it('should send a mock message', function(done) {
      
      var obj = {
        channel: 'C123',
        type: 'message',
        text: 'Hello world',
        user: 'U123'
      };
      
      this.slack.on('init', function() {
        this.slack.mock(JSON.stringify(obj));  
      }.bind(this));
      
      this.slack.on('message', function(data) {
        // console.log('SUCCESS');
        // console.log(data);
        data.type.should.be.a('string');
        data.type.should.equal('message');
        data.text.should.be.a('string');
        data.text.should.equal('Hello world');
        done();
      });
    });

    it('should send a mock request', function(done) {
      var obj = {
        token: 'ABC-123-EFG-456',
        'as-user': true,
        text: 'hello world',
        attachments: [{
          fallback: 'hello world',
          image_url: 'http://some-url.com'
        }]
      };

      this.slack.request('chat.postMessage', JSON.stringify(obj), function(err, result) {
        // console.log('post message');
        // console.log(err, result)
        should.not.exist(err);
        result.should.be.an('object');
        result.message.text.should.be.a('string');
        result.ok.should.equal(true);
        done();
      });
    });
  });
});