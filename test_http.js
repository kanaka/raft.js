#!/usr/bin/env node

http = require('./http');

serverPool = {};
function startHttp (opts) {
    opts = opts || {};
    opts.serverMap = {0:"localhost:9000",
                      1:"localhost:9001",
                      2:"localhost:9002"};
    for (var i=0; i < 3; i++) {
        var o = http.copyOpts(opts);
        o.listenPort = 9000+i;
        serverPool[i] = new http.RaftServerHttp(i.toString(), o);
    }
}

function getAll(attr) {
    var results = {};
    for (var i in serverPool) {
        if (!serverPool.hasOwnProperty(i)) { continue; }
        results[i] = serverPool[i]._self[attr];
    }
    return results;
}
 
function getLeaderId() {
    for (var i in serverPool) {
        if (!serverPool.hasOwnProperty(i)) { continue; }
        if (serverPool[i]._self.state === 'leader') {
            return i;
        }
    }
    return null;
}


if (require.main === module) {
    startHttp();
} else {
    exports.serverPool = serverPool;
    exports.startHttp = startHttp;
    exports.serverPool = serverPool;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
