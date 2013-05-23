"use strict";

var VERSION             = "0.0.1",
    CONTROL_CHANNEL     = 0,
    MAX_FRAME_BUFFER    = 131072,       // 128k, same as rabbitmq (which was 
                                        // copying qpid)
    EMPTY_FRAME_SIZE    = 8,            // This is from the javaclient
    MAX_FRAME_SIZE      = MAX_FRAME_BUFFER - EMPTY_FRAME_SIZE;


module.exports = Connection;

var EventEmitter, debug, inherits, methods, stringify;


EventEmitter    = require('events').EventEmitter;

inherits        = require('utils').inherits;

debug           = require('./util.js').debug;

methods         = require('./methods.js');

stringify       = JSON.stringify;


inherits(Connection, EventEmitter);

function Connection(options) {

    if (!this instanceof Connection) {
        return new Connection(options);
    }

    if ('string' === typeof options) {
        options = require('url').parse(options);
    }

    this.options = options;

    this.serverProperties = null; // set this null, we'll use it later.

    this.stream  = new (require('net').Stream)();
    
    this.parser  = new (require('./parser'))(this);
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
        this.handleConnStart(args);
        break;

    case methods.connectionTune:
        this.handleConnTune(args);
        break;

    case methods.connectionOpenOk:
        this.handleConnOpenOk(args);
        break;

    case methods.connectionClose:
        this.handleConnClose(args);
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

Connection.prototype.send = function send() {};

Connection.prototype.end = function end(/*callback*/) {};

Connection.prototype.createChannel = function createChannel() {
    return new (require('./channel.js'))();
};

Connection.prototype.handleConnStart = function handleConnStart(args) {
    
    // We check that they're serving us AMQP 0-9
    if (args.versionMajor !== 0 && args.versionMinor !== 9) {
        this.end();
        this.emit("error", new Error("Bad server version"));
        return;
    }
    
    // Keep a memo of the serverProperties TODO: find out why
    this.serverProperties = args.serverProperties;
    
    // 3. Then we reply with StartOk, containing our "useless" information.
    this.send(CONTROL_CHANNEL, methods.connectionStartOk, {

        clientProperties: {
            version:    VERSION,
            platform:   'node-' + process.version,
            product:    this.options.productName || 'node-amqp-simple'
        },

        mechanism:      'AMQPLAIN', // TODO: should we support EXTERNAL auth?
        
        response: {
            LOGIN:      this.options.login,
            PASSWORD:   this.options.password
        },
        
        locale:         this.options.locale || 'en_US'
    });
};

Connection.prototype.handleConnTune = function handleConnTune() {
    // 5. We respond with connectionTuneOk
    this.send(CONTROL_CHANNEL, methods.connectionTuneOk, {

        channelMax:     0
        frameMax:       maxFrameBuffer
        heartbeat:      this.options.heartbeat || 0
    });
    
    // 6. Then we have to send a connectionOpen request
    this.send(CONTROL_CHANNEL, methods.connectionOpen, {

        virtualHost:    this.options.vhost,

        // TODO: find out what the rest of these flags do...

        // capabilities: '',
        // insist: true,

        reserved1:      '',

        reserved2:      true
    });
};

Connection.prototype.handleConnOpenOk = function handleConnOpenOk() {
    // 7. Finally they respond with connectionOpenOk
    this.emit('ready');
};

Connection.prototype.handleConnClose = function handleConnClose(args) {
    var err;

    err         = new Error(args.replyText);
    err.code    = args.replyCode;
    
    // TODO: deeply consider the below commented code.

    // if (!this.listeners('close').length && !this.implOptions.reconnect) {
    //     console.log('Unhandled connection error: ' + args.replyText);
    // }
    
    this.destroy(e);
};