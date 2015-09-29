# slackbot

### Installation

    $ npm install seed-slackbot

### Slackbot API

##### constructor({Object} options)

Options should contain a `token` field that is string.
Options could contain an `ignoreSlackbot` field, that is an optional boolean and true by default
Options could contain an `ignoreReplies` field, that is an optional boolean and true by default

```javascript
var Slack = require('seed-slackbot');
var slack = new Slack({ token: 'ABC123' });
```

##### request({String} method, {Object} data, {Function} callback(error, result)):Slack

Used to call slack web api

```javascript
slack.request('chat.postMessage', msg, function(err, result) {});
```

##### channel({String} term):Object

Get channel by name or id

```javascript
var channel = slack.channel('1234');
```

##### user({String} term):Object

Get user by name or id

```javascript
var user = slack.user('4567');
```

##### im({String} term):Object

Get IM by id or user name or user id

```javascript
var im = slack.im('5678');
```

##### send({String} channelId, {String} message):Slack

Send message to channel

```javascript
slack.send('1234', 'Hello world!');
```

##### sendIm({String} userId, {String} message):Slack

Send message to IM

```javascript
slack.sendIm('9876', 'Hello user!');
```

##### stream():DuplexStream

Create a duplex stream

```javascript
var stream = slack.stream();

stream.pipe(through(chunk, enc, cb) {
  chunk.message // message text
  chunk.context.message // slack message object
  chunk.context.data // slack data, eg. all ims, users, channels, self, etc.
  chunk.context.user // user object
  chunk.context.channel // channel object
  this.push({ type: 'result', args: [channelId, messageText]);
  cb();
}).pipe(stream);
```

### Usage

```javascript
var Slack = require('seed-slackbot');
var slack = new Slack({ token: process.env.SLACK_TOKEN });

slack.on('message', function(data) {
  slack.send(channel, message);
  slack.sendIM(userId, message);
  slack.request('chat.postMessage', msg, function(err, result) {
    
  });
});
```

### License

MIT