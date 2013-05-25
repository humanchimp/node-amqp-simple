/* jshint node:true, unused:true, eqnull:true */
"use strict";

module.exports = Exchange;

function Exchange(name, options) {
    var self;

    self = this;

    if (!self instanceof Exchange) {
        return new Exchange(name, options);
    }

    self.name     = name;
    self.options  = options;
}