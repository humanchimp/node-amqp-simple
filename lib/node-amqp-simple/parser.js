"use strict";

module.exports = AMQPParser;

function AMQPParser() {
    var self;

    self = this;

    if (!self instanceof AMQPParser) {
        return new AMQPParser;
    }
}