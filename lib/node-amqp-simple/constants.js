/* jshint node:true */
exports.VERSION     = "0.0.1";

exports.DEBUG               = !!process.env.NODE_DEBUG_AMQP_SIMPLE;
    
exports.CONTROL_CHANNEL     = 0;

exports.MAX_FRAME_BUFFER    = 131072;       // 128k; same as rabbitmq (which was 
                                    // copying qpid)
exports.EMPTY_FRAME_SIZE    = 8;            // This is from the javaclient

exports.MAX_FRAME_SIZE      = exports.MAX_FRAME_BUFFER - exports.EMPTY_FRAME_SIZE;

exports.DEFAULT_PORTS       = { amqp: 5672, amqps: 5671 };

exports.DEFAULT_OPTIONS = {
    host:               'localhost',

    port:               DEFAULT_PORTS.amqp,

    login:              'guest',

    password:           'guest',

    vhost:              '/'
};