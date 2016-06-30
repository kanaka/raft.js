/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2016 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for description and usage instructions.
 */

"use strict"

if (typeof module !== 'undefined') {
    var fs = require('fs'),
        RaftServerBase = require("./base").RaftServerBase
} else {
    var local = {},
        exports = local,
        fs = null
}

// RaftServer that uses in-process communication for RPC
// Most useful for testing
function RaftServerLocal(id, opts) {
    if (!(this instanceof RaftServerLocal)) {
        // Handle instantiation without "new"
        return new RaftServerLocal(id, opts)
    }

    // Call the superclass
    RaftServerBase.call(this, id, opts)

    if (!opts.serverPool) {
        throw new Error("opts.serverPool required")
    }

    if (id in opts.serverPool) {
        throw new Error("Server id '" + id + "' already exists")
    }

    opts.serverPool[id] = this

//TODO
//    if (!opts.serverData) {
//        throw new Error("opts.serverData required")
//    }

    // Default options
    this.setDefault('durable', true)
    this.setDefault('savePath', "raft.store." + id)
}
RaftServerLocal.prototype = Object.create(RaftServerBase.prototype)
RaftServerLocal.prototype.constructor = RaftServerLocal


RaftServerLocal.prototype.sendRPC = function(targetId, rpcName, args) {
    this.dbg("RPC to "  + targetId + ": " + rpcName)
    if (!targetId in this._opts.serverPool) {
        console.log("Server id '" + targetId + "' does not exist")
        // No target, just drop RPC (no callback)
        return
    }
    this._opts.serverPool[targetId][rpcName](args)
}

RaftServerLocal.prototype.applyCmd = function(stateMachine, cmd) {
    // TODO: sanity check args
    switch (cmd.op) {
        case 'get': stateMachine[cmd.key]; break
        case 'set': stateMachine[cmd.key] = cmd.value; break
        default: throw new Error("invalid command: '" + cmd.op + "'")
    }
    return stateMachine[cmd.key]
}

RaftServerLocal.prototype.saveFn = function(data, callback) {
    if (this._opts.durable && fs) {
        var dstr = JSON.stringify(data)
        //var dstr = JSON.stringify(data,null,2)
        fs.writeFile(this._opts.savePath, dstr, function(err) {
            if(callback) {
                callback(!err)
            }
        })
    } else {
        this._opts.serverStore[this.id] = data
        if(callback) {
            callback(true)
        }
    }
}

RaftServerLocal.prototype.loadFn = function(callback) {
    if (this._opts.durable && fs) {
        fs.readFile(this._opts.savePath, function(err, dstr) {
            if (!err) {
                try {
                    var data = JSON.parse(dstr)
                    callback(true, data)
                } catch (e) {
                    callback(false)
                }
            } else {
                callback(false)
            }
        })
    } else {
        var data = this._opts.serverStore[this.id]
        if (data) {
            callback(true, data)
        } else {
            callback(false)
        }
    }
}


exports.RaftServerLocal = RaftServerLocal
