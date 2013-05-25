/* jshint node:true, unused:true, eqnull:true */
"use strict";

module.exports = (function () {
    var protocol;

    protocol = require('../../protocol/amqp-0-9-1.json');

    return protocol.classes.reduce(function (methods, classInfo/*, i*/) {
        
        classInfo.methods.forEach(function (methodInfo/*, j*/) {
            var method, name;
            //var classMethods, method, name;

            name =  classInfo.name + 
                    methodInfo.name[0].toUpperCase() +
                    methodInfo.name[1];
            
            method = {
                name:           name,
                fields:         methodInfo.fields,
                // classIndex:     i,
                // methodIndex:    j
            };

            // TODO: find out what this is used for, and kill it:
            // classMethods        = methods[i] || (methods[i] = []);
            // classMethods[i][j]  = method;

            methods[name] = method;

        });

        return methods;

    }, {});

}());