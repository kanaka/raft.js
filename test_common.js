
serverMap = {};

function startServers (spool, serverOpts, klass) {
    for (var sid in serverOpts) {
        var addr = serverOpts[sid].listenAddress;
        serverMap[sid] = addr;
    }
    for (var sid in serverOpts) {
        serverOpts[sid].serverMap = serverMap;
        spool[sid] = new klass(sid.toString(), serverOpts[sid]);
    }
}

function getAll(spool, attr) {
    var results = {};
    for (var i in spool) {
        if (!spool.hasOwnProperty(i)) { continue; }
        results[i] = spool[i]._self[attr];
    }
    return results;
}

function getLeaderId(spool) {
    for (var i in spool) {
        if (!spool.hasOwnProperty(i)) { continue; }
        if (spool[i]._self.state === 'leader') {
            return i;
        }
    }
    return null;
}

exports.startServers = startServers;
exports.getAll = getAll;
exports.getLeaderId = getLeaderId;
