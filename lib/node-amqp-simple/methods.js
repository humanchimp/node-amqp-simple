module.exports = (function () {
    var protocol, classes, methodTable;

    protocol = require('../../protocol/amqp-0-9-1.json');

    // methods = [];

    // methodMap = {};

    return protocol.classes.reduce(function (map, classInfo, i) {
        
        classInfo.methods.forEach(function (methodInfo, j) {
            var method, name;
            //var classMethods, method, name;

            name = classInfo.name
                 + methodInfo.name[0].toUpperCase()
                 + methodInfo.name[1];
            
            method = {
                name:           name,
                fields:         methodInfo.fields,
                classIndex:     i,
                methodIndex:    j
            };

            // TODO: find out what this is used for, and kill it:
            // classMethods        = methods[i] || (methods[i] = []);
            // classMethods[i][j]  = method;

            map[name] = method;

        });

        return map;

    }, {});

}());