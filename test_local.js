#!/usr/bin/env node

server = require('./server.js');

function startTest (opts) {
    for (var i=0; i < 3; i++) {
        new server.RaftServerLocal(i, [0,1,2], opts);
    }
}

if (require.main === module) {
    startTest();
} else {
    exports.startTest = startTest;
    exports.server = server;
}
