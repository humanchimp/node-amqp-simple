"use strict";

module.exports = Queue;

function Queue(name, options) {
    var self;

    self = this;

    if (!self instanceof Queue) {
        return new Queue(name, options);
    }

    self.name     = name;
    self.options  = options;
}