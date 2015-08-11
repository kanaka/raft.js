#!/usr/bin/env node

var opts = require('minimist')(process.argv.slice(2),
                               {default: {port: 8001,
                                          home: 'rtc.html'}});
var express = require('express');
var app = express();
var ExpressPeerServer = require('peer').ExpressPeerServer;

// PeerJS default options
var options = {
    debug: true
}

// Create PeerJS server channel
function newPeerServerChannel(channel) {
    var peerServer = ExpressPeerServer(server, options);

    // Attach PeerJS server to Express server
    app.use('/api/' + channel, peerServer);

    // PeerJS event handlers
    peerServer.on('connection', function (id) {
        console.log("connection - channel: " + channel + ", ID:", id);
        console.log("peers:", Object.keys( peerServer._clients.peerjs));
    });

    peerServer.on('disconnect', function (id) {
        console.log("disconnect - channel: " + channel + ", ID:", id);
        console.log("peers:", Object.keys( peerServer._clients.peerjs));
    });

    app.get('/peers/' + channel, function(req, res, next) {
        res.send(JSON.stringify(Object.keys( peerServer._clients.peerjs)));
    });
}

var channelCnt = 0;

app.get('/', function(req, res, next) {
    var channel = null;
    // Pass along query parameters
    var query = "";
    for (var k in req.query) {
        query += '&'+k+'='+req.query[k];
        if (k === 'channel') {
            channel = req.query[k];
        }
    }
    if (channel === null) {
        channel = channelCnt++;
    }
    newPeerServerChannel(channel);

    // Full redirect URL
    var url = opts.home + '?channel=' + channel + query + '#firstServer';
    res.send('<html><head><meta http-equiv="refresh" content="0; url=' + url + '"/></head></html>');
});


// Static file serving
app.use( express.static('./'));

// Start Express server
var server = app.listen(opts.port);
console.log("Server started on port " + opts.port);

