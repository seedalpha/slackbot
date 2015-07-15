/**
 * Module dependencies
 */

var webSocket   = require('ws');
var request     = require('request');
var debug       = require('debug');
var fmt         = require('util').format;
var Emitter     = require('events').EventEmitter;
var inherits     = require('util').inherits;

/**
 * Logger
 */

var log = debug('slackbot');

/**
 * Constructor
 *
 * @param {Object} options
 *   @param {String} token
 */

function Slack(options) {
  if (!(this instanceof Slack)) {
    return new Slack(options);
  }
  
  Emitter.call(this);
  
  this.token = options.token;
  this.messageId = 0;
    
  this.request('rtm.start', function(err, data) {
    if (err) throw err;
    this.data = data;
    this.connect();
  }.bind(this));
  
  this.$emit = this.emit.bind(this);
  
  this.emit = function(data) {
    log("Send: %j", data);
    data.id = this.messageId++;
    this.ws.send(JSON.stringify(data));
  }.bind(this);
}

inherits(Slack, Emitter);

/**
 * Request slack web api
 *
 * @param {String} method
 * @param {Object} data, optional
 * @param {Function} callback(err, result)
 */

Slack.prototype.request = function(method, data, callback) {
  if (typeof data === 'function') {
    callback = data;
    data = {};
  }
  
  data.token = this.token;
  
  function cb(err, response, body) {
    if (err || response.statusCode !== 200) {
      return callback(err || response.statusCode);
    }
    callback(null, JSON.parse(body));
  }
  
  request
    .post(fmt('https://slack.com/api/%s', method), cb)
    .form(data);
}

/**
 * Connect to Slack RTM
 */

Slack.prototype.connect = function() {
  this.ws = new webSocket(this.data.url);
  var data = this.data;
  this.ws
    .on('open', function() {
      log('transport %s. Connected as %s[%s]', data.self.name, data.self.id);
    }).on('close', function(data) {
      log('Disconnected. Error: %s', data);
    }).on('error', function(data) {
      log('Error. Error: %s', data);
    }).on('message', function(data) {
      data = JSON.parse(data);
      log('Recieved: %j', data);
      this.$emit('*', data);
      this.$emit(data.type, data);
    }.bind(this));
}

/**
 * Get channel by id or name
 */

Slack.prototype.channel = function(term) {
  var channel = find(this.data.channels, 'name', term);
  if (!channel) {
    channel = find(this.data.channels, 'id', term);
  }
  return channel;  
}

/**
 * Get user by id or name
 */

Slack.prototype.user = function(term) {
  var user = find(this.data.users, 'name', term);
  if (!user) {
    user = find(this.data.users, 'id', term);
  }
  return user;  
};

/**
 * Get IM by user, user.id or id
 */

Slack.prototype.im = function(term) {
  var im = find(this.data.ims, 'user', term);
  if (!im) {
    var user = this.user(term);
    if (user) {
      im = find(this.data.ims, 'user', user.id);
    }
  }
  if (!im) {
    im = find(this.data.ims, 'id', term)
  }
  return im;
}

/**
 * Send message to channel
 */

Slack.prototype.send = function(channel, text) {
  if (typeof channel === typeof text) {
    this.emit({
      type: 'message',
      channel: channel,
      text: text
    });
  } else {
    this.emit(channel);
  }
}

/**
 * Send ping message
 */

Slack.prototype.ping = function() {
  this.emit({
    type: 'ping'
  });
};

/**
 * Find element in array by field value
 *
 * @param {Array} arr
 * @param {String} field
 * @param {*} value
 * @return {Object} element
 */

function find(arr, field, value) {
  var out;
  arr.some(function(item) {
    if (item[field] === value) {
      out = item;
      return true;
    }
  });
  return out;
}

/**
 * Expose
 */

exports = module.exports = Slack;