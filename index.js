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
 *
 * @api private
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
      
      if (data.type === events.team_join) {
        this.data.users.push(data.user);
      }
      
      this.$emit('*', data);
      this.$emit(data.type, data);
    }.bind(this));
}

/**
 * Get channel by id or name
 *
 * @param {String} term, channel name or id
 * @return {Object} channel
 */

Slack.prototype.channel = function(term) {
  return find(this.data.channels, 'name', term) ||  
    find(this.data.channels, 'id', term);
}

/**
 * Get user by id or name
 *
 * @param {String} term, user name or id
 * @return {Object} user
 */

Slack.prototype.user = function(term) {
  return find(this.data.users, 'name', term) ||
    find(this.data.users, 'id', term);
};

/**
 * Get IM by user, user.id or im.id
 *
 * @param {String} term, username, userid or im id
 * @return {Object} im
 */

Slack.prototype.im = function(term) {
  return find(this.data.ims, 'user', term) ||
    find(this.data.ims, 'user', this.user(term).id) ||
    find(this.data.ims, 'id', term);
}

/**
 * Send message to channel
 *
 * @param {String} channel, channel id
 * @param {String} text, text to send
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
 * Send a private message (initiate)
 *
 * @param {String} user, user id
 * @param {String} text, message to send
 */

Slack.prototype.sendIM = function(user, text) {
  var im = this.im(user);
  user = this.user(user);
  
  if (im) {
    return this.send(im.id, text);
  }

  this.request('im.open', { 
    user: user.id
  }, function(err, result) {
    if (err) return log(err);
    if (result.ok === true) {
      this.data.ims.push(result.channel);
      this.send(result.channel.id, text);
    } else {
      log('Unable to create IM channel for user %j', user);
    }
  }.bind(this));
}

/**
 * Send ping message
 *
 * @api private
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