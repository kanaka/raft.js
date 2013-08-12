#!/usr/bin/env node

common = require('./test_common');
http = require('./http');

serverPool = {};
portIdx = 9000;

function startServers(opts, n) {
    n = n || 3;
    var serverOpts = {};
    for (var i=0; i<n; i++) {
        serverOpts[i] = http.copyMap(opts);
        serverOpts[i].listenAddress = "localhost:" + (portIdx++);
    }
    return common.startServers(serverPool, serverOpts,
                                  http.RaftServerHttp);
}

function addServer(sid, opts) {
    opts = http.copyMap(opts);
    opts.listenAddress = "localhost:" + (portIdx++);
    return common.addServer(serverPool, sid, opts,
                            http.RaftServerHttp);
}

function getAll(attr) {
    return common.getAll(serverPool, attr);
}
 
function getLeaderId() {
    return common.getLeaderId(serverPool);
}


if (require.main === module) {
    startServers();
} else {
    exports.http = http;
    exports.startServers = startServers;
    exports.addServer = addServer;
    exports.serverPool = serverPool;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
