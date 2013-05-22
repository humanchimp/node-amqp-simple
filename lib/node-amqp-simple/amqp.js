"use strict";

var Connection, extend;

// TODO: decide whether including a library like lodash is sensible.
extend = require('lodash').extend;

Connection = require('./connection.js');

// this is unfortunate, but I'm settling on it for now:
module.exports = Connection.createConnection;

extend( module.exports, {

    Connection:     Connection,

    Channel:        require('./channel.js'),

    Parser:         require('./parser.js'),

    Exchange:       require('./exchange.js'),

    Queue:          require('./queue.js')
});