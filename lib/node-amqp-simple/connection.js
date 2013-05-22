"use strict";

module.exports = Connection;

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
    self.stream  = new (require('net').Stream);
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

Connection.prototype.connect = function connect(callback) {

};

Connection.prototype.end = function disconnect(callback) {

};

Connection.prototype.createChannel = function createChannel() {
    var Channel;

    Channel = require('./channel.js');

    return new Channel;
};