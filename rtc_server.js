#!/usr/bin/env node

var express = require('express');
var app = express();
var ExpressPeerServer = require('peer').ExpressPeerServer;

app.get('/', function(req, res, next) { res.send('Hello world!'); });

// Static file serving
app.use( express.static('./'));

// Start Express server
var server = app.listen(8001);

// Create PeerJS server
var options = {
        debug: true
}
var peerServer = ExpressPeerServer(server, options);

// Attach PeerJS serer to Express server
app.use('/api', peerServer);


// PeerJS event handlers
peerServer.on('connection', function (id) {
    console.log("connection, ID:", id);
    console.log("peers:", Object.keys( peerServer._clients.peerjs));
});

peerServer.on('disconnect', function (id) {
    console.log("disconnect, ID:", id);
    console.log("peers:", Object.keys( peerServer._clients.peerjs));
});

app.get('/peers', function(req, res, next) {
    res.send(JSON.stringify(Object.keys( peerServer._clients.peerjs)));
});



