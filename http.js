/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2013 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for description and usage instructions.
 */

"use strict"

var RaftServerLocal = require("./local").RaftServerLocal,
    url = require("url"),
    http = require("http")

// RaftServer that uses HTTP communication for RPC
function RaftServerHttp(id, opts) {
    if (!(this instanceof RaftServerHttp)) {
        // Handle instantiation without "new"
        return new RaftServerHttp(id, opts)
    }

    // Call the superclass
    RaftServerLocal.call(this, id, opts)

    if (!opts.listenAddress) {
        throw new Error("opts.listenAddress is required")
    }

    // TODO: better way to track server addresses
    if (!opts.serverAddress) {
        throw new Error("opts.serverAddress is required")
    }

    // start listening server
    var httpServer = http.createServer(function(request, response) {
        var dstr = ""
        request.on('data', function (chunk) {
            dstr += chunk
        })
        request.on('error', function(error) {
            this.error("got error:", error, targetId, rpcName)
        }.bind(this))
        request.on('end', function(){
            var data = JSON.parse(dstr),
                rpcName = data[0],
                args = data[1]
            this.dbg("Got RPC " + rpcName)
            response.end()
            this[rpcName](args)
        }.bind(this))
    }.bind(this))
    httpServer.on('close', function() {
        this.warn("Server closed")
    }.bind(this))

    var parts = opts.listenAddress.split(/:/),
        port = parts[parts.length-1],
        host = parts[parts.length-2]
    httpServer.listen(port, host)
}
RaftServerHttp.prototype = Object.create(RaftServerLocal.prototype)
RaftServerHttp.prototype.constructor = RaftServerHttp


RaftServerHttp.prototype.sendRPC = function(targetId, rpcName, args) {
    var saddr = this._opts.serverAddress[targetId],
        ropts = url.parse("http://" + saddr)
    ropts.method = 'POST'
    this.dbg("Send RPC to "  + targetId + " [" + saddr + "]: " + rpcName)
    var req = http.request(ropts, function (response) {
        response.on('data', function (chunk) {})
        response.on('end', function (chunk) {})
    })
    req.on('error', function(error) {
        this.info("got error:", error, targetId, rpcName)
    }.bind(this))
    req.write(JSON.stringify([rpcName, args]))
    req.end()
}

exports.RaftServerHttp = RaftServerHttp
