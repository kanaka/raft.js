if (typeof module !== 'undefined') {
    var copyMap = require('./base').copyMap,
        RaftServerLocal = require('./local').RaftServerLocal,
        test_common = require('./test_common'),
        tests = require('./tests')
} else {
    var test_local = {},
        exports = test_local
}

serverPool = {}  // Map of server IDs to raft instances
idIdx = 0

function startServers(opts, n) {
    n = n || 3
    var serverOpts = {}
    for (var i=0; i<n; i++) {
        serverOpts[i] = copyMap(opts)
        serverOpts[i].serverPool = serverPool
        serverOpts[i].listenAddress = "local:" + (idIdx++)
    }
    test_common.startServers(RaftServerLocal, serverOpts)
    return serverOpts
}

if (typeof require !== 'undefined' && require.main === module) {
    startServers()
    tests.test1(serverPool)
} else {
    exports.serverPool = serverPool
    exports.startServers = startServers
}

