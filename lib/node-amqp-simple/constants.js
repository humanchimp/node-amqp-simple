module.exports = {

    VERSION:            "0.0.1",

    DEBUG:              !!process.env.NODE_DEBUG_AMQP_SIMPLE,
        
    CONTROL_CHANNEL:    0,

    MAX_FRAME_BUFFER:   131072,       // 128k, same as rabbitmq (which was 
                                        // copying qpid)
    EMPTY_FRAME_SIZE:   8,            // This is from the javaclient

    MAX_FRAME_SIZE:     MAX_FRAME_BUFFER - EMPTY_FRAME_SIZE,

    DEFAULT_PORTS:      { amqp: 5672, amqps: 5671 },

    DEFAULT_OPTIONS:    {
        host:               'localhost',

        port:               DEFAULT_PORTS.amqp,

        login:              'guest',

        password:           'guest',

        vhost:              '/'
    }

};