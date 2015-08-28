# slackbot

### Installation

    $ npm install seed-slackbot

### Usage

```javascript
var Slack = require('slack');
var slack = new Slack(token);

slack.on('message', function(data) {
  slack.send(channel, message);
  slack.sendIM(userId, message);
  slack.request('chat.postMessage', msg, function(err, result) {
    
  });
});
```

### License

MIT