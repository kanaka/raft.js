/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2013 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for description and usage instructions.
 */

"use strict";

if (typeof module !== 'undefined') {
    var fs = require('fs');
    var base = require("./base");
} else {
    var local = {},
        exports = local,
        fs = null;
}

// RaftServer that uses in-process communication for RPC
// Most useful for testing
var _serverPool = {};
var _serverStore = {};
function RaftServerLocal(id, opts) {
    var self = this,
        opts = base.copyMap(opts), // make a local copy
        savePath = "raft.store." + id;

    if (id in _serverPool) {
        throw new Error("Server id '" + id + "' already exists");
    }
    if (!opts.serverMap) {
        throw new Error("opts.serverMap is required");
    }
    base.setDefault(opts, 'durable', true);
    
    function sendRPC(targetId, rpcName, args, callback) {
        self.dbg("RPC to "  + targetId + ": " + rpcName + " (" + args + ")");
        if (!targetId in _serverPool) {
            console.log("Server id '" + targetId + "' does not exist");
            // No target, just drop RPC (no callback)
            return;
        }
        _serverPool[targetId][rpcName](args,
                function(results) {
                    callback(targetId, results);
                }
        );
    }

    if (opts.durable && fs) {
        // Data/commands sent in sendRPC and applied in applyCmd must be
        // serializable/unserializable by saveFn/loadFn
        var saveFn = function(data, callback) {
            var dstr = JSON.stringify(data);
            //var dstr = JSON.stringify(data,null,2);
            fs.writeFile(savePath, dstr, function(err) {
                if(callback) {
                    callback(!err);
                }
            });
        }

        var loadFn = function(callback) {
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
    } else {
        var saveFn = function(data, callback) {
            _serverStore[id] = data;
            if(callback) {
                callback(true);
            }
        }

        var loadFn = function(callback) {
            var data = _serverStore[id]
            if (data) {
                callback(true, data);
            } else {
                callback(false);
            }
        }
    }

    function applyCmd(stateMachine, cmd) {
        // TODO: sanity check args
        switch (cmd.op) {
            case 'get': stateMachine[cmd.key]; break;
            case 'set': stateMachine[cmd.key] = cmd.value; break;
        }
        return stateMachine[cmd.key];
    };


    // Options
    if (!opts.loadFn) { opts.loadFn = loadFn; }
    if (!opts.saveFn) { opts.saveFn = saveFn; }
    if (!opts.sendRPC) { opts.sendRPC = sendRPC; }
    if (!opts.applyCmd) { opts.applyCmd = applyCmd; }

    // Call the superclass
    var api = base.RaftServerBase.call(self, id, opts);
    _serverPool[id] = api;
    return api;
}

exports.copyMap = base.copyMap;
exports.RaftServerLocal = RaftServerLocal;
exports._serverPool = _serverPool;
exports._serverStore = _serverStore;
