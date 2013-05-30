/* jshint node:true, unused:true, eqnull:true */
"use strict";

module.exports = createParser;

var AMQPParser, constants, debug;

constants = require('./constants');

DEBUG = constants.DEBUG;

AMQPParser = require('../../reference/original-amqp-parser.js');

debug = require('./util').debug;

function createParser(conn) {
    var parser;

    parser = new AMQPParser('0-9-1', 'client');
    /*
    * void handleMethod()
    */
    parser.onMethod = function handleMethod(channelId, method, args) {
        conn.handleMethod(channelId, method, args);
    };
    /*
    * void handleContent()
    */
    parser.onContent = function handleContent(channelId, data) {
        var channel;

        if (DEBUG) {
            debug(channel + " > content " + data.length);
        }

        channel = conn.channels[channelId];

        if (channel) {
            channel.handleContent(channel, data);
        } else {
            debug("unhandled content: " + data);
        }
    };
    /*
    * void handleContentHeader()
    */
    parser.onContentHeader = function handleContentHeader(
        channelId,
        classInfo,
        weight,
        properties,
        size
    ) {
        var debugInfo, channel;

        if (DEBUG) {
            debugInfo = [classInfo.name, weight, properties, size];
            debug(channelId + " > content header ", debugInfo);
        }

        channel = conn.channels[channelId];

        if (channel) {
            channel.handleContentHeader(
                classInfo,
                weight,
                properties,
                size
            );
        } else if (DEBUG) {
            debug("unhandled content header");
        }
    };
    /*
    * void handleHeartbeat()
    */
    parser.onHeartBeat = function handleHeartbeat() {
        conn.emit('heartbeat');
        if (DEBUG) {
            debug('heartbeat');
        }
    };
    /*
    * void handleError()
    */
    parser.onError = function handleError(err) {
        conn.emit('error', err);
        conn.close();
    };

    return parser;
}