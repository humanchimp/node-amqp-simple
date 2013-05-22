"use strict";

module.exports = AMQPParser;

var originalParser = require('../../reference/original-amqp-parser.js');

function AMQPParser() {
    var self;

    self = this;

    if (!self instanceof AMQPParser) {
        return new AMQPParser;
    }
}