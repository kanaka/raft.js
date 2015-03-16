"use strict";

// Parmeters
var verbose = 1,
    debug = true,
    electionTimeout = 1000,
    connPollDelay = 3000;

// Global state
var messages = document.getElementById('messages'),
    node_link = document.getElementById('node_link'),
    channel = null,
    nodeId = null,
    node = null,
    nodeMap = {};

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// Get the channel
channel = getParameterByName('channel');

// Setup the new node link
node_link.href = location.origin + location.pathname + location.search;
node_link.innerHTML = node_link.href;
// Set firstServer from the hash, then unset the hash
var firstServer = false;
if (location.hash === "#firstServer") {
    firstServer = true;
    location.hash = "";
}

// Logging
function log() {
    var msg = Array.prototype.slice.call(arguments, 0).join(' ');
    messages.innerHTML += msg + "\n";
    messages.scrollTop = messages.scrollHeight;
}


//
// Send and receive functions
//
function rtcSend(targetId, rpcName, args, callback) {
    // Callback is ignored (no session tracked request/response with RTC)
    var conn = nodeMap[targetId],
        json = JSON.stringify([rpcName, nodeId, args]);
    //log("rtcSend:", targetId, json);
    conn.send(json);
}
function rtcReceive(json) {
    var resp = JSON.parse(json),
        rpcName = resp[0],
        otherNodeId = resp[1],
        args = resp[2];
    
    // Call the rpc indicated
    node[rpcName](args);
}

//
// Setup PeerJS connections
//
var peer = new Peer({host: location.hostname,
                     port: location.port,
                     path: '/api/' + channel});
peer.on('open', function(id) {
    log('my RTC ID:', id);
    nodeId = id;
    // Put ourself into the map
    nodeMap[nodeId] = null;

    // Load the peer list and connect
    jQuery.getJSON('/peers/' + channel, function (peers) {
        log("RTC peer list:", peers);
        $.each(peers, function (idx, peer_id) {
            // If it is us, or we are already connected, ignore
            if (peer_id in nodeMap) return true;
            if (peer_id === nodeId) {
                // Ignore
                return true;
            }

            log("Connecting to RTC peer:", peer_id);
            var conn = peer.connect(peer_id);
            nodeMap[peer_id] = conn;
            conn.on('data', function(data) {
                //log("received from " + conn.peer + ": " + data);
                rtcReceive(data);
            });
            conn.on('close', function(data) {
                log("RTC connection closed:" + conn.peer);
                delete nodeMap[peer_id];
            });
        });
    });

    // Create the local raft.js node
    log("Starting Raft node");
    var opts = {verbose: verbose,
                debug: debug,
                log: log,
                serverData: nodeMap,
                firstServer: firstServer,
                sendRPC: rtcSend,
                electionTimeout: electionTimeout};

    node = new local.RaftServerLocal(nodeId, opts);

});

peer.on('error', function(e) {
    log('peer error:', e);
});
peer.on('connection', function(conn) {
    log("Got RTC connection from:", conn.peer);
    nodeMap[conn.peer] = conn;
    conn.on('data', function(data) {
        //log("received from " + conn.peer + ": " + data);
        rtcReceive(data);
    });
    conn.on('close', function(data) {
        log("RTC connection closed:" + conn.peer);
        delete nodeMap[conn.peer];
    });
});

