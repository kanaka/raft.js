/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2013 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for description and usage instructions.
 */

"use strict";

var local = require("./local"),
    url = require("url"),
    http = require("http");

// RaftServer that uses HTTP communication for RPC
function RaftServerHttp(id, opts) {
    var self = this,
        api;

    if (!opts.serverData) {
        throw new Error("opts.serverData is required");
    }
    if (!opts.listenAddress) {
        throw new Error("opts.listenAddress is required");
    }

    function sendRPC(targetId, rpcName, args) {
        var saddr = opts.serverData[targetId],
            ropts = url.parse("http://" + saddr);
        ropts.method = 'POST';
        self.dbg("Send RPC to "  + targetId + " [" + saddr + "]: " + rpcName);
        var req = http.request(ropts, function (response) {
            response.on('data', function (chunk) {});
            response.on('end', function (chunk) {});
        });
        req.on('error', function(error) {
            self.info("got error:", error, targetId, rpcName);
        });
        req.write(JSON.stringify([rpcName, args]));
        req.end();
    }

    // start listening server
    var httpServer = http.createServer(function(request, response) {
        var dstr = "";
        request.on('data', function (chunk) {
            dstr += chunk;
        });
        request.on('error', function(error) {
            self.info("got error:", error, targetId, rpcName);
        });
        request.on('end', function(){
            var data = JSON.parse(dstr),
                rpcName = data[0],
                args = data[1];
            self.dbg("Got RPC " + rpcName);
            response.end();
            api[rpcName](args);
        })
    });
    httpServer.on('close', function() {
        console.log("Server closed");
    });
    var parts = opts.listenAddress.split(/:/),
        port = parts[parts.length-1],
        host = parts[parts.length-2];
    httpServer.listen(port, host);

    // Options
    if (!opts.sendRPC) { opts.sendRPC = sendRPC; }

    // Call the superclass
    api = local.RaftServerLocal.call(self, id, opts);
    return api;
}

exports.copyMap = local.copyMap;
exports.RaftServerHttp = RaftServerHttp;
