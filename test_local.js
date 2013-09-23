#!/usr/bin/env node

common = require('./test_common');
local = require('./local');

serverPool = local._serverPool;

function startServers(opts, n) {
    n = n || 3;
    var serverOpts = {};
    for (var i=0; i < 3; i++) {
        serverOpts[i] = local.copyMap(opts);
        serverOpts[i].listenAddress = "local:" + i;
    }
    return common.startServers(serverPool, serverOpts,
                               local.RaftServerLocal);
}

function addServer(sid, opts) {
    opts = local.copyMap(opts);
    opts.listenAddress = "local:" + sid;
    return common.addServer(serverPool, sid, opts,
                            local.RaftServerLocal);
}

function getAll(attr) {
    return common.getAll(serverPool, attr);
}
 
function getLeaderId() {
    return common.getLeaderId(serverPool);
}


if (require.main === module) {
    startLocal();
} else {
    exports.local = local;
    exports.startServers = startServers;
    exports.addServer = addServer;
    exports.serverPool = serverPool;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
