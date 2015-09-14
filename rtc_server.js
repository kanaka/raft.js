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
var channels = {};

app.get('/' + opts.home, function(req, res, next) {
    var channel = null;
    // Pass along query parameters
    var query = "";
    for (var k in req.query) {
        query += '&'+k+'='+req.query[k];
        if (k === 'channel') {
            channel = req.query[k];
        }
    }
    if (channel === null || (!(channel in channels))) {
        // Redirect to make sure URL has channel parameter and is also
        // marked as the firstServer
        if (channel === null) {
            // Assign an unused channel number
            do {
                channel = channelCnt++;
            } while (channel in channels);
            var url = '/' + opts.home + '?channel=' + channel + query + '#firstServer';
        } else {
            var url = '/' + opts.home + '?' + query + '#firstServer';
        }
        // Create a new channel
        channels[channel] = newPeerServerChannel(channel);
        // Do the redirect
        res.send('<html><head><meta http-equiv="refresh" content="0; url=' + url + '"/></head></html>');
    } else {
        // The channel already exists, continue
        next();
    }
});


// Static file serving
app.use(express.static('./'));

// Start Express server
var server = app.listen(opts.port);
console.log("Server started on port " + opts.port);

