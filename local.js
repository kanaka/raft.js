/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2013 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for description and usage instructions.
 */

"use strict";

var fs = require('fs');
var base = require("./base");

function copy(obj) {
    var nobj = {};
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) nobj[k] = obj[k];
    }
    return nobj;
};

// RaftServer that uses in-process communication for RPC
// Most useful for testing
var _serverPool = {};
var _serverStore = {};
function RaftServerLocal(id, opts) {
    "use strict";
    var self = this,
        opts = copy(opts); // make a local copy

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

    function saveFn(data, callback) {
        _serverStore[id] = data;
        if(callback) {
            callback(true);
        }
    }

    function loadFn(callback) {
        var data = _serverStore[id]
        if (data) {
            callback(true, data);
        } else {
            callback(false);
        }
    }

    function applyCmd(stateMachine, cmd) {
        // By default treat cmd as a function to apply
        return cmd(stateMachine);
    };


    // Options
    if (!opts.serverStart) {
        throw new Error("opts.serverStart is required");
    }
    if (!opts.loadFn) { opts.loadFn = loadFn; }
    if (!opts.saveFn) { opts.saveFn = saveFn; }
    if (!opts.sendRPC) { opts.sendRPC = sendRPC; }
    if (!opts.applyCmd) { opts.applyCmd = applyCmd; }

    // Call the superclass
    var api = base.RaftServerBase.call(self, id, opts);
    _serverPool[id] = api;
    return api;
}

function RaftServerLocalDurable(id, opts) {
    "use strict";
    var self = this,
        opts = copy(opts), // make a local copy
        savePath = "raft.store." + id;
    
    function saveFn(data, callback) {
        var dstr = JSON.stringify(data);
        fs.writeFile(savePath, dstr, function(err) {
            if(callback) {
                callback(!err);
            }
        });
    }

    function loadFn(callback) {
        fs.readFile(savePath, function(err, dstr) {
            if (!err) {
                try {
                    var data = JSON.parse(dstr);
                    callback(true, data);
                } catch (e) {
                    callback(false);
                }
            } else {
                callback(false);
            }
        });
    }

    function applyCmd(stateMachine, cmd) {
        var op=cmd[0], key=cmd[1], value=cmd[2];
        // TODO: sanity check args
        switch (op) {
            case 'get': stateMachine[key]; break;
            case 'set': stateMachine[key] = value; break;
        }
        return stateMachine[key];
    };


    // Options
    if (!opts.loadFn) { opts.loadFn = loadFn; }
    if (!opts.saveFn) { opts.saveFn = saveFn; }
    if (!opts.applyCmd) { opts.applyCmd = applyCmd; }

    // Call the superclass
    var api = RaftServerLocal.call(self, id, opts);
    _serverPool[id] = api;
    //console.log("_serverPool: ", _serverPool);
    return api;
}


exports.RaftServerLocal = RaftServerLocal;
exports.RaftServerLocalDurable = RaftServerLocalDurable;
exports._serverPool = _serverPool;
exports._serverStore = _serverStore;
