# slackbot

### Installation

    $ npm install seed-slackbot

### Slackbot API

##### constructor({Object|String} options)

Options should contain a `token` field that is string.
Options could contain an `processSlackbot` field, that is an optional boolean and false by default
Options could contain an `processReplies` field, that is an optional boolean and false by default

```javascript
var Slack = require('seed-slackbot');
var slack = new Slack({ token: 'ABC123', processReplies: true });
var slack = new Slack('ABC123'); // shorthand
```

##### request({String} method, {Object} data, {Function} callback(error, result)):Slack

Used to call slack web api

```javascript
slack.request('chat.postMessage', msg, function(err, result) {});
```

##### channel({String} term):Object

Get channel by name or id

```javascript
var channel = slack.channel('C1234');
```

##### user({String} term):Object

Get user by name or id

```javascript
var user = slack.user('U4567');
```

##### im({String} term):Object

Get IM by id or user name or user id

```javascript
var im = slack.im('C5678');
```

##### self():Object

Get current user

```javascript
var self = slack.self();
```

##### send({String|Object} channelId, {String} message):Slack

Send message to channel

```javascript
slack.send('1234', 'Hello world!');
slack.send({ type: 'message', channel: '1234', text: 'Hello world!' }); // alternative
```

##### stream():DuplexStream

Get slackbot's internal duplex stream

```javascript
var stream = slack.stream();

stream.pipe(through(function(message, enc, cb) {
  if (message.type === 'presence_change' && message.user === slack.self().id) {
    this.push(['test', 'I\'m back!']);
  }
  cb();
})).pipe(stream);
```

### Usage

```javascript
var Slack = require('seed-slackbot');
var slack = new Slack({ token: process.env.SLACK_TOKEN });

slack.on('message', function(data) {
  slack.send(channel, message);
  slack.request('chat.postMessage', msg, function(err, result) {
    
  });
});
```

### License

MIT