#!/usr/bin/env node

common = require('./test_common');
local = require('./local');

serverPool = local._serverPool;

function _startLocal (opts, n, klass) {
    n = n || 3;
    var serverOpts = {};
    for (var i=0; i < 3; i++) {
        serverOpts[i] = local.copyMap(opts);
        serverOpts[i].listenAddress = "local:" + i;
    }
    return common.startServers(serverPool, serverOpts, klass);
}

function startLocal(opts, n) {
    return _startLocal(opts, n, local.RaftServerLocal);
}

function startLocalDurable(opts, n) {
    return _startLocal(opts, n, local.RaftServerLocalDurable);
}

function getAll(attr) {
    return common.getAll(serverPool, attr);
}
 
function getLeaderId() {
    return common.getLeaderId(serverPoool);
}


if (require.main === module) {
    startLocal();
} else {
    exports.local = local;
    exports.startLocal = startLocal;
    exports.startLocalDurable = startLocalDurable;
    exports.serverPool = serverPool;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
