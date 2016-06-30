if (typeof module !== 'undefined') {
    var copyMap = require('./base').copyMap,
        RaftServerHttp = require('./http').RaftServerHttp,
        test_common = require('./test_common'),
        tests = require('./tests')
} else {
    var test_http = {},
        exports = test_http
}

serverPool = {}  // Map of server IDs to raft instances
serverAddress = {} // Map of server IDs to listen addresses
portIdx = 9000

function startServers(opts, n) {
    n = n || 3
    var serverOpts = {}
    for (var i=0; i<n; i++) {
        serverOpts[i] = copyMap(opts)
        serverOpts[i].serverPool = serverPool
        serverOpts[i].listenAddress = "localhost:" + (portIdx++)

        serverAddress[i] = serverOpts[i].listenAddress
        serverOpts[i].serverAddress = serverAddress
    }
    test_common.startServers(RaftServerHttp, serverOpts)
    return serverOpts
}

if (typeof require !== 'undefined' && require.main === module) {
    startServers()
    tests.test1(serverPool)
} else {
    exports.serverPool = serverPool
    exports.startServers = startServers
}

