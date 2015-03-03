if (typeof module !== 'undefined') {
    var common = require('./test_common');
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
    return common.startServers(serverPool, serverOpts,
                                    local.RaftServerLocal);
}

/*
function addServer(sid, opts) {
    opts = local.copyMap(opts);
    opts.listenAddress = "local:" + sid;
    return common.addServer(serverPool, sid, opts,
                                 local.RaftServerLocal);
}

function removeServer(sid) {
    common.removeServer(serverPool, sid);
}
*/

function getAll(attr) {
    return common.getAll(serverPool, attr);
}
 
function getLeaderId() {
    return common.getLeaderId(serverPool);
}


if (typeof require !== 'undefined' && require.main === module) {
    //startServers({verbose: true});
    startServers();
    console.log("Waiting 2 seconds for leader election");
    setTimeout(function () {
        var lid = getLeaderId();
        console.log("leader: " + lid);
        common.validateState(serverPool);
        serverPool[lid].clientRequest({op:"set",key:'a',value:1});
        serverPool[lid].clientRequest({op:"set",key:'b',value:2});
        serverPool[lid].clientRequest({op:"set",key:'a',value:3});
        console.log("Waiting 1 second for log propagation");
        setTimeout(function () {
            common.validateState(serverPool);
            common.showState(serverPool);
            console.log("Validated server pool state");
            process.exit(0);
        }, 1000);
    }, 2000);
} else {
    exports.local = local;
    exports.startServers = startServers;
    //exports.addServer = addServer;
    exports.serverPool = serverPool;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
