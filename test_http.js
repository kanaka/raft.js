#!/usr/bin/env node

common = require('./test_common');
http = require('./http');

serverPool = {};

function startHttp(opts, n) {
    n = n || 3;
    var serverOpts = {};
    for (var i=0; i<n; i++) {
        serverOpts[i] = http.copyMap(opts);
        serverOpts[i].listenAddress = "localhost:" + (9000 + i);
    }
    return common.startServers(serverPool, serverOpts,
                                  http.RaftServerHttp);
}

//function addServers(opts, n) {
//}

function getAll(attr) {
    return common.getAll(serverPool, attr);
}
 
function getLeaderId() {
    return common.getLeaderId(serverPool);
}


if (require.main === module) {
    startHttp();
} else {
    exports.http = http;
    exports.startHttp = startHttp;
    exports.serverPool = serverPool;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
