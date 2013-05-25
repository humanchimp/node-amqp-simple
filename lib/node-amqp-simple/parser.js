/* jshint node:true, unused:true, eqnull:true */
"use strict";

module.exports = createParser;

var AMQPParser, debug;

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

        debug(channel + " > content " + data.length);

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

        debugInfo = [classInfo.name, weight, properties, size];
        debug(channelId + " > content header ", debugInfo);

        channel = conn.channels[channelId];

        if (channel) {
            channel.handleContentHeader(
                classInfo,
                weight,
                properties,
                size
            );
        } else {
            debug("unhandled content header");
        }
    };
    /*
    * void handleHeartbeat()
    */
    parser.onHeartBeat = function handleHeartbeat() {
        conn.emit('heartbeat');
        debug('heartbeat');
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