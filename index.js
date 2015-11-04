/**
 * Module dependencies
 */

var webSocket   = require('ws');
var request     = require('request');
var debug       = require('debug');
var fmt         = require('util').format;
var Events      = require('events').EventEmitter;
var inherits    = require('util').inherits;
var through     = require('through2').obj;
var duplexify   = require('duplexify');

/**
 * Logger
 */

var log   = debug('slackbot');
log.error = debug('slackbot:error');

/**
 * Slack Events (just for the reference)
 */

var events = {
    hello: 'hello',
    message: 'message',
    channel_marked: 'channel_marked',
    channel_created: 'channel_created',
    channel_joined: 'channel_joined',
    channel_left: 'channel_left',
    channel_deleted: 'channel_deleted',
    channel_rename: 'channel_rename',
    channel_archive: 'channel_archive',
    channel_unarchive: 'channel_unarchive',
    channel_history_changed: 'channel_history_changed',
    im_created: 'im_created',
    im_open: 'im_open',
    im_close: 'im_close',
    im_marked: 'im_marked',
    im_history_changed: 'im_history_changed',
    group_joined: 'group_joined',
    group_left: 'group_left',
    group_open: 'group_open',
    group_close: 'group_close',
    group_archive: 'group_archive',
    group_unarchive: 'group_unarchive',
    group_rename: 'group_rename',
    group_marked: 'group_marked',
    group_history_changed: 'group_history_changed',
    file_created: 'file_created',
    file_shared: 'file_shared',
    file_unshared: 'file_unshared',
    file_public: 'file_public',
    file_private: 'file_private',
    file_change: 'file_change',
    file_deleted: 'file_deleted',
    file_comment_added: 'file_comment_added',
    file_comment_edited: 'file_comment_edited',
    file_comment_deleted: 'file_comment_deleted',
    pong: 'pong',
    pin_added: 'pin_added',
    pin_removed: 'pin_removed',
    presence_change: 'presence_change',
    manual_presence_change: 'manual_presence_change',
    pref_change: 'pref_change',
    user_change: 'user_change',
    user_typing: 'user_typing',
    team_join: 'team_join',
    team_migration_started: 'team_migration_started',
    star_added: 'star_added',
    star_removed: 'star_removed',
    emoji_changed: 'emoji_changed',
    commands_changed: 'commands_changed',
    team_plan_change: 'team_plan_change',
    team_pref_change: 'team_pref_change',
    team_rename: 'team_rename',
    team_domain_change: 'team_domain_change',
    email_domain_changed: 'email_domain_changed',
    bot_added: 'bot_added',
    bot_changed: 'bot_changed',
    accounts_changed: 'accounts_changed',
    reaction_added: 'reaction_added',
    reaction_removed: 'reaction_removed'
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
 * Mock socket
 */

function mockSocket(slack) {
  var socket = new Events();
  socket.send = function(payload) {
    process.nextTick(function() {
      slack.emit('mock:message', payload);
    });
  }
  // slack.mock = function(payload) {
  //   process.nextTick(function() {
  //     socket.emit('message', payload);
  //   });
  // }
  process.nextTick(function() {
    socket.emit('open');
  });
  return socket;
}

/**
 * Constructor
 *
 * @param {Object} options
 *   @param {String} token
 *   @param {Boolean} processSlackbot, default false
 *   @param {Boolean} processReplies, default false
 *   @param {Boolean} processSubtypes, default false
 *   @param {Boolean} mock, default false
 */

function Slack(options) {
  if (!(this instanceof Slack)) {
    return new Slack(options);
  }
  
  Events.call(this);
  
  if (typeof options === 'string') {
    options = { token: options };
  }
  
  this._token           = options.token;
  this._processSlackbot = options.processSlackbot;
  this._processReplies  = options.processReplies;
  this._processSubtypes = options.processSubtypes;
  this._processSelf     = options.processSelf;
  this._mock            = options.mock;
  
  this._messageId       = 0;
  this._messages        = [];
  this._data            = null;
  
  this._writeable       = through(handle);
  this._readable        = through();
  this._stream          = duplexify(
    this._writeable, 
    this._readable,
    { objectMode: true }
  );
  
  var self = this;
  
  function handle(chunk, enc, cb) {
    if (Array.isArray(chunk)) {
      // plain text message, use rtm
      self.send(chunk[0], chunk[1]);
    } else {
      // object, use request
      if (chunk.attachments && typeof chunk.attachments !== 'string') {
        chunk.attachments = JSON.stringify(chunk.attachments);
      }
      
      self.request('chat.postMessage', chunk, function(err, result) {
        if (err) return log.error(err);
      });      
    }
    cb();
  }
  
  if (this._mock) {
    this.mock = function(payload) {
      process.nextTick(function() {
        this._ws.emit('message', payload);
      }.bind(this));
    }.bind(this);
  }

  this._init();
}

inherits(Slack, Events);

/*
 * Request slack rtm endpoint; download inital state
 *
 * @emit 'init'
 * @api private
 */

Slack.prototype._init = function() {
  this._connected = false;
  this.request('rtm.start', function(err, data) {
    if (err) throw err;
    this._data = data;
    this.emit('init', data);
    this._connect();
  }.bind(this));
}

/**
 * Connect to Slack RTM
 *
 * @api private
 */

Slack.prototype._connect = function() {
  this._ws = (this._mock) ? mockSocket(this) : new webSocket(this._data.url);
  
  var data = this._data;
  var self = this;
  
  this._ws.on('open', function() {
    log('transport %s. Connected as %s', data.self.name, data.self.id);
    self._connected = true;
    while(self._messages.length) {
      self._send(self._messages.shift());
    }
  });
  
  this._ws.on('close', function(reason) {
    self._connected = false;
    log.error('Disconnected. Reason: %s', reason);
  });
  
  this._ws.on('error', function(error) {
    log.error('Error. Error: %s', error);
  });
  
  this._ws.on('message', function(message) {
    message = JSON.parse(message);
    
    if (message.user === 'USLACKBOT' && !self._processSlackbot) {
      return log('Ignored Slackbot message: %j', message);
    }
    
    if (typeof message.reply_to !== 'undefined' && !self._processRelies) {
      return log('Ignored Reply message: %j', message);
    }
    
    if (typeof message.subtype !== 'undefined' && !self._processSubtypes) {
      return log('Ignored Subtype message: %j', message);
    }
    
    if (message.user === self._data.self.id && !self._processSelf) {
      return log('Ignored Self message: %j', message);
    }
    
    log('Recieved: %j', message);
    
    switch(message.type) {
    // @ref https://api.slack.com/events/team_join
    case events.team_join: 
      data.users.push(message.user);
      self.request('im.open', { user: message.user.id }, function(err, result) {
        if (err) {
          return log.error(err);
        }
        if (!result.ok) {
          return log.error('Unable to create IM channel for user %j %j', user, result);
        }
        result.channel.user = result.channel.user || message.user.id;
        data.ims.push(result.channel);
        self._push(message);
      });
      return;
      break;
    // @ref https://api.slack.com/events/team_migration_started
    case events.team_migration_started:
      return self._init();
      break;
    // @ref https://api.slack.com/events/group_joined
    case events.group_joined:
      data.channels.push(message.channel);
      break;
    // @ref https://api.slack.com/events/channel_joined
    case events.channel_joined:
      data.channels.push(message.channel);
      break;
    // @ref https://api.slack.com/events/user_change
    case events.user_change: 
      var user = find(data.users, 'id', message.user.id);
      if (user) {
        data.users.splice(data.users.indexOf(user), 1, message.user);
      }
      break;
    case events.hello:
      break;
    }
    
    self._push(message);
  });
}

/**
 * Dispatch new message 
 *
 * @api private
 */

Slack.prototype._push = function(message) {
  if (message.user) {
    var user = this.user(message.user);
    if (user) {
      message.user = {
        id: user.id,
        name: user.name,
        real_name: user.real_name,
        is_admin: user.is_admin,
        is_owner: user.is_owner,
        is_bot: user.is_bot
      }
    }
  }

  if (message.channel) {
    var channel = this.channel(message.channel);
    if (channel) {
      message.channel = channel;
    }
  }

  var user = this.user(this._data.self.id)

  message.self = {
    id: user.id,
    name: user.name,
    real_name: user.real_name,
    is_admin: user.is_admin,
    is_owner: user.is_owner,
    is_bot: user.is_bot
  };
  
  this._readable.push(message); // { type: 'message', channel: {...}, user: {...}, self: {...}, text: '...' }
  this.emit('*', message);
  this.emit(message.type, message);
}

/**
 * Validate and send message to slack
 *
 * @api private
 */

Slack.prototype._send = function(msg) {
  if (!this._connected) {
    return this._messages.push(msg);
  }
  
  var channel = this.channel(msg.channel);
  
  if (!channel) {
    return log.error('Dropping a message (reason: cant find a channel) %j', msg);
  }
  
  msg.id = this._messageId++;
  
  var payload = JSON.stringify(msg);
  
  if (payload.length > 16 * 1024) {
    return log.error('Dropping a message (reason: more than 16kb size) %j', msg);
  }
  
  if (channel.is_im === false && payload.length > 4000) {
    return log.error('Dropping a message (reason: more than 4000 chars long on a public channel) %j', msg);
  }
  
  log("Sending: %j", msg);
  this._ws.send(payload);
}

/**
 * Send (rtm) message to a channel
 *
 * @param {String|Object} channel, channel id
 * @param {String} text, text to send
 * @return {Slack} self
 *
 * @example
 *   .send('C123', 'Hello')
 *   or
 *   .send({ type: 'message', channel: 'C123', text: 'Hello' })
 */

Slack.prototype.send = function(channel, text) {
  if (typeof channel === typeof text) {
    this._send({
      type: 'message',
      channel: this.channel(channel).id,
      text: text
    });
  } else {
    this._send(channel);
  }
  
  return this;
}

/**
 * Request slack web api
 *
 * @param {String} method
 * @param {Object} data, optional
 * @param {Function} callback(err, result)
 * @return {Slack} self
 */

Slack.prototype.request = function(method, data, callback) {
  if (typeof data === 'function') {
    callback = data;
    data = {};
  }
  
  data.token = this._token;
  
  function cb(err, response, body) {
    if (err || response.statusCode !== 200) {
      return callback(err || response.statusCode);
    }
    callback(null, JSON.parse(body));
  }
  
  var url = fmt('https://slack.com/api/%s', method);
  
  if (this._mock) {
    process.nextTick(function() {
     this.emit('mock:request', { url: url, method: method, data: data, callback: callback }); 
    }.bind(this));
    
  } else {
    request.post(url, cb).form(data);
  }
  
  return this;
}

/**
 * Get channel by id or name or user
 *
 * @param {String} term, channel name or id
 * @return {Object} channel
 */

Slack.prototype.channel = function(term) {
  return find(this._data.channels, 'name', term) ||  
    find(this._data.channels, 'id', term) ||
    find(this._data.ims, 'id', term) ||
    find(this._data.groups, 'id', term) ||
    find(this._data.groups, 'name', term);
}

/**
 * Get user by id or name
 *
 * @param {String} term, user name or id
 * @return {Object} user
 */

Slack.prototype.user = function(term) {
  return find(this._data.users, 'name', term) ||
    find(this._data.users, 'id', term);
};

/**
 * Get IM by user, user.id or im.id
 *
 * @param {String} term, username, userid or im id
 * @return {Object} im
 */

Slack.prototype.im = function(term) {
  return find(this._data.ims, 'user', term) ||
    find(this._data.ims, 'user', this.user(term).id) ||
    find(this._data.ims, 'id', term);
}

/**
 * Get self
 *
 * @return {Object} user
 */

Slack.prototype.self = function() {
  return this.user(this._data.self.id);
}

/**
 * Get message stream
 *
 * @return {Duplex} stream
 */

Slack.prototype.stream = function() {
  return this._stream;
}

/**
 * Expose
 */

exports = module.exports = Slack;