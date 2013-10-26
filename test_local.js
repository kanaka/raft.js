if (typeof module !== 'undefined') {
    var test_common = require('./test_common');
    var local = require('./local');
} else {
    var test_local = {},
        exports = test_local;
}

serverPool = local._serverPool;
idIdx = 0;

function startServers(opts, n) {
    n = n || 3;
    var serverOpts = {};
    for (var i=0; i < 3; i++) {
        serverOpts[i] = local.copyMap(opts);
        serverOpts[i].listenAddress = "local:" + (idIdx++);
    }
    return test_common.startServers(serverPool, serverOpts,
                                    local.RaftServerLocal);
}

function addServer(sid, opts) {
    opts = local.copyMap(opts);
    opts.listenAddress = "local:" + sid;
    return test_common.addServer(serverPool, sid, opts,
                                 local.RaftServerLocal);
}

function removeServer(sid) {
    test_common.removeServer(serverPool, sid);
}

function getAll(attr) {
    return test_common.getAll(serverPool, attr);
}
 
function getLeaderId() {
    return test_common.getLeaderId(serverPool);
}


if (typeof require !== 'undefined' && require.main === module) {
    startServers();
} else {
    exports.local = local;
    exports.startServers = startServers;
    exports.addServer = addServer;
    exports.serverPool = serverPool;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
