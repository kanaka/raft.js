"use strict";

var base = require("./base");

// RaftServer that uses in-process communication for RPC
// Most useful for testing
var _serverPool = {};
var _serverStore = {};
function RaftServerLocal(id, all_servers, opts) {
    "use strict";
    var self = this;
    if (id in _serverPool) {
        throw new Error("Server id '" + id + "' already exists");
    }
    
    function sendRPC(targetId, rpcName, args, callback) {
        self.dbg("RPC to "  + targetId + ": " + rpcName + " (" + args + ")");
        if (!targetId in _serverPool) {
            console.log("Server id '" + targetId + "' does not exist");
            // No target, just drop RPC (no callback)
            return;
        }
        _serverPool[targetId][rpcName](args,
                // NOTE: non-local servers need to rewrite
                // 'not_leader' results
                function(results) {
                    callback(targetId, results);
                }
        );
    }

    var optsCopy = {};
    for (var k in opts) {
        if (opts.hasOwnProperty(k)) optsCopy[k] = opts[k];
    }
    
    optsCopy.saveFn = function(data, callback) {
        _serverStore[id] = data;
        if(callback) {
            callback();
        }
    }

    optsCopy.loadFn = function(callback) {
        var data = _serverStore[id]
        if (data) {
            callback(true, _serverStore[id]);
        } else {
            callback(false);
        }
    }

    optsCopy.serverStart = all_servers;
    var api = base.RaftServerBase.call(self, id, sendRPC, optsCopy);
    _serverPool[id] = api;
    //console.log("_serverPool: ", _serverPool);
    return api;
}


exports.RaftServerLocal = RaftServerLocal;
exports._serverPool = _serverPool;
exports._serverStore = _serverStore;
