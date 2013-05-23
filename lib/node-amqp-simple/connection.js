"use strict";

module.exports = Connection;

var EventEmitter, debug, inherits, methods, stringify;

EventEmitter    = require('events').EventEmitter;
inherits        = require('utils').inherits;
debug           = require('./util').debug;
methods         = require('./methods');

stringify       = JSON.stringify;

inherits(Connection, EventEmitter);

function Connection(options) {
    var self;

    self = this;

    if (!self instanceof Connection) {
        return new Connection(options);
    }

    if ('string' === typeof options) {
        options = require('url').parse(options);
    }

    self.options = options;

    self.stream  = new (require('net').Stream)();
    
    self.parser  = new (require('./parser'))(self);
}
/*
* Connection.createConnection(options)
*
* It's a factory method for creating connections.  Handy for hooking
* onto other objects.  In this case, it is exported especially so that
* the library can export it again, cutely, to support usage like:
*
*   `var conn = require('amqp-simple').connect();`
*/
Connection.createConnection = function createConnection(options) {
    return new Connection(options);
};

Connection.prototype.handleMethod = function handleMethod(
    channelId,
    method,
    args
) {
    switch (method) {

    case methods.connectionStart:
        this.handleConnectionStart(args);
        break;

    case methods.connectionTune:
        this.handleConnectionTune(args);
        break;

    case methods.connectionOpenOk:
        this.handleConnectionOpenOk(args);
        break;

    case methods.connectionClose:
        this.handleConnectionClose(args);
        break;

    default:
        this.emit("error", "Unhandled method: " + method.name +
                           " with args " + stringify(args));
    }
    
    debug(channelId + " > " + method.name + " ", args);
    
};

Connection.prototype.connect = function connect() {
    // Time to start the AMQP 7-way connection initialization handshake!
    // 1. The client sends the server a version string
    this.stream.write("AMQP" + String.fromCharCode(0,0,9,1));

    return this;
};

Connection.prototype.end = function end(callback) { callback(); };

Connection.prototype.createChannel = function createChannel() {
    return new (require('./channel.js'))();
};

Connection.prototype.handleConnectionStart = function handleConnectionStart(args) {
    // // We check that they're serving us AMQP 0-9
    // if (args.versionMajor != 0 && args.versionMinor != 9) {
    // this.end();
    // this.emit('error', new Error("Bad server version"));
    // return;
    // }
    // this.serverProperties = args.serverProperties;
    // // 3. Then we reply with StartOk, containing our useless information.
    // this._sendMethod(0, methods.connectionStartOk,
    //   { clientProperties:
    //     { version: '0.0.1'
    //     , platform: 'node-' + process.version
    //     , product: this.productName || 'node-amqp'
    //     }
    //   , mechanism: 'AMQPLAIN'
    //   , response:
    //     { LOGIN: this.options.login
    //     , PASSWORD: this.options.password
    //     }
    //   , locale: 'en_US'
    //   });
};

Connection.prototype.handleConnectionTune = function handleConnectionTune(args) {
  // // 5. We respond with connectionTuneOk
  // this._sendMethod(0, methods.connectionTuneOk,
  //     { channelMax: 0
  //     , frameMax: maxFrameBuffer
  //     , heartbeat: this.options.heartbeat || 0
  //     });
  // // 6. Then we have to send a connectionOpen request
  // this._sendMethod(0, methods.connectionOpen,
  //     { virtualHost: this.options.vhost
  //     // , capabilities: ''
  //     // , insist: true
  //     , reserved1: ''
  //     , reserved2: true
  //     });
};

Connection.prototype.handleConnectionOpenOk = function handleConnectionOpenOk(args) {
      // // 7. Finally they respond with connectionOpenOk
      // // Whew! That's why they call it the Advanced MQP.
      // if (this._readyCallback) {
      //   this._readyCallback(this);
      //   this._readyCallback = null;
      // }
      // this.emit('ready');
};

Connection.prototype.handleConnectionClose = function handleConnectionClose(args) {
      // var e = new Error(args.replyText);
      // e.code = args.replyCode;
      // if (!this.listeners('close').length && !this.implOptions.reconnect) {
      //   console.log('Unhandled connection error: ' + args.replyText);
      // }
      // this.destroy(e);
};