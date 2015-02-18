"use strict";

// Parmeters
var verbose = false,
    debug = true,
    electionTimeout = 1000,
    nodeCnt = 3,
    connPollDelay = 3000;

// Global state
var messages = document.getElementById('messages'),
    nodeId = null,
    node = null,
    nodeMap = {};


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
                     path: '/api'});
peer.on('open', function(id) {
    log('my ID:', id);
    nodeId = id;
    // Load the peer list and connect
    jQuery.getJSON('/peers', function (peers) {
        log("Peer list:", peers);
        $.each(peers, function (idx, peer_id) {
            // If it is us, or we are already connected, ignore
            if (peer_id in nodeMap) return true;
            if (peer_id === nodeId) {
                // Put self into the map
                nodeMap[peer_id] = null;
                return true;
            }

            log("Connecting to:", peer_id);
            var conn = peer.connect(peer_id);
            nodeMap[peer_id] = conn;
            conn.on('data', function(data) {
                //log("received from " + conn.peer + ": " + data);
                rtcReceive(data);
            });
            conn.on('close', function(data) {
                log("Connection closed:" + conn.peer);
                delete nodeMap[peer_id];
            });
        });
    });

});
peer.on('error', function(e) {
    log('peer error:', e);
});
peer.on('connection', function(conn) {
    log("got connection from:", conn.peer);
    nodeMap[conn.peer] = conn;
    conn.on('data', function(data) {
        //log("received from " + conn.peer + ": " + data);
        rtcReceive(data);
    });
    conn.on('close', function(data) {
        log("Connection closed:" + conn.peer);
        delete nodeMap[conn.peer];
    });
});

//
// Raft nodes setup
//
// TODO: Do this once nodeMap reaches 3
function startRaft() {
    var curNodeCnt = Object.keys(nodeMap).length;
    if (curNodeCnt >= nodeCnt) {
        log("Starting Raft cluster");
        var opts = {verbose: verbose,
                    debug: debug,
                    log: log,
                    serverMap: nodeMap,
                    sendRPC: rtcSend,
                    electionTimeout: electionTimeout};

        node = new local.RaftServerLocal(nodeId, opts);
    } else {
        log("Waiing: " + curNodeCnt + "/" + nodeCnt + " nodes present");
        setTimeout(startRaft, connPollDelay);
    }
}
startRaft();

