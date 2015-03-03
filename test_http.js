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

/*
function addServer(sid, opts) {
    opts = http.copyMap(opts);
    opts.listenAddress = "localhost:" + (portIdx++);
    return common.addServer(serverPool, sid, opts,
                            http.RaftServerHttp);
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
    exports.http = http;
    exports.startServers = startServers;
    //exports.addServer = addServer;
    exports.serverPool = serverPool;
    exports.getAll = getAll;
    exports.getLeaderId = getLeaderId;
}
