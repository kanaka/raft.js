"use strict";

// Parmeters
var verbose = 1,
    debug = true,
    electionTimeout = 1000,
    // addRemoveServersRetry: smaller values increase the number of
    // PENDING_CONFIG_CHANGE that will happen when there are multiple
    // changes pending (more than one server added or removed). Larger
    // values mean that multiple changes may take longer to complete.
    addRemoveServersRetry = 50,
    // addRemoveServersPoll: smaller values increase the CPU usage due
    // to constant scanning of the PeerJS connections and Raft.js
    // server map to identify nodes that need to be added or dropped.
    // Larger values means that it takes longer to detect when cluster
    // changes happen.
    addRemoveServersPoll = 500;

// Global state
var messages = document.getElementById('messages'),
    node_link = document.getElementById('node_link'),
    Tterm = document.getElementById('term'),
    Tstate = document.getElementById('state'),
    Tcluster_size = document.getElementById('cluster_size'),
    Tlog_length = document.getElementById('log_length'),
    Trv_count = document.getElementById('rv_count'),
    Trvr_count = document.getElementById('rvr_count'),
    Tae_count = document.getElementById('ae_count'),
    Taer_count = document.getElementById('aer_count'),
    channel = null,
    nodeId = null,
    node = null,
    nodeMap = {},
    rpcCounts = {
        requestVote: 0,
        requestVoteResponse: 0,
        appendEntries: 0,
        appendEntriesResponse: 0};

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// Get the channel
var channel = getParameterByName('channel');
var console_logging = getParameterByName('console_logging');

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
    if (console_logging) {
        console.log(msg);
    }
    messages.innerHTML += msg + "\n";
    messages.scrollTop = messages.scrollHeight;
}

function updateStats() {
    //console.log("here1:", node._self.currentTerm, node._self.state);
    Tterm.innerHTML = node._self.currentTerm;
    Tstate.innerHTML = node._self.state;
    Tcluster_size.innerHTML = Object.keys(node._self.serverMap).length;
    Tlog_length.innerHTML = node._self.log.length;
    Trv_count.innerHTML = rpcCounts['requestVote'] + "/" + rpcCounts['requestVoteResponse'];
    Tae_count.innerHTML = rpcCounts['appendEntries'] + "/" + rpcCounts['appendEntriesResponse'];
    requestAnimationFrame(updateStats);
}


//
// Send and receive functions
//
function rtcSend(targetId, rpcName, args, callback) {
    // Callback is ignored (no session tracked request/response with RTC)
    var conn = nodeMap[targetId],
        json = JSON.stringify([rpcName, nodeId, args]);
    rpcCounts[rpcName]++;
    if (targetId === nodeId) {
        // Local send
        rtcReceive(json);
    } else if (conn) {
        conn.send(json);
    } else {
        // TODO: server went away
    }
}
function rtcReceive(json) {
    var resp = JSON.parse(json),
        rpcName = resp[0],
        otherNodeId = resp[1],
        args = resp[2];
    rpcCounts[rpcName]++;
    
    // Call the rpc indicated
    node[rpcName](args);
}

// Wrap async clientRequest/clientRequestResponse messages into
// a callback based clientRequest call
var curLeaderId = null;
var pendingClientRequest = null;
function clientRequest(args, callback) {
    //log("clientRequest:", args);
    if (pendingClientRequest) {
        // TODO: fix this
        throw new Error("outstanding clientRequest");
    }
    args['responseId'] = nodeId;
    pendingClientRequest = {args: args, callback: callback};
    if (curLeaderId === null || curLeaderId === nodeId) {
        node.clientRequest(args);
    } else {
        rtcSend(curLeaderId, 'clientRequest', args);
    }
}
function clientRequestResponse(result) {
    //log("clientRequestResponse:", result);
    if (result.status === 'NOT_LEADER') {
        curLeaderId = result.leaderHint;
        if (pendingClientRequest) {
            var args = pendingClientRequest.args;
            //log("curLeaderId:", curLeaderId, nodeMap[curLeaderId]);
            rtcSend(curLeaderId, 'clientRequest', args);
        }
    } else {
        var callback = pendingClientRequest.callback,
            args = pendingClientRequest.args;
        pendingClientRequest = null;
        callback(result);
    }
}

//
// Setup PeerJS connections
//

function addRemoveServersAsync() {
    var changes = 0;

    if (node && node._self.state === 'leader') {
        //log("addRemoveServersAsync, nodeMap IDs: " + Object.keys(nodeMap) + 
        //    ", serverMap IDs: " + Object.keys(node._self.serverMap));

        // If an ID is in map1 but not in map2 then call rpc with
        // {argKey: ID} as the argument. However, only one change will
        // be requested at a time.
        var diffNodes = function(map1, map2, rpc, argKey) {
            var peerIds = Object.keys(map1);
            for (var i=0; i<peerIds.length; i++) {
                var peerId = peerIds[i],
                    cb = (function() {
                        var id=peerId; // capture current val
                        return function(res) {
                            if (res.status === 'OK') {
                                log("finished " + rpc + " of " + id);
                            } else {
                                log("could not " + rpc + " of " +
                                    id + ": " + res.status);
                            }
                        };
                    })();
                if (!(peerId in map2)) {
                    changes += 1;
                    // Only make one modification each round
                    if (changes > 1) continue;

                    log(rpc + " of " + peerId);
                    var args = {};
                    args[argKey] = peerId;
                    node[rpc](args, cb);
                }
            }
        }

        // Scan to see if there are new servers in the nodeMap that
        // are not in the current node erverMap and add them
        diffNodes(nodeMap, node._self.serverMap, "addServer", "newServer");

        // Scan to see if there are servers in the current node
        // serverMap that are not in the nodeMap and remove them
        diffNodes(node._self.serverMap, nodeMap, "removeServer", "oldServer");
    }

    if (changes > 1) {
        // If there is still pending changes then cycle around faster
        setTimeout(addRemoveServersAsync, addRemoveServersRetry);
    } else {
        setTimeout(addRemoveServersAsync, addRemoveServersPoll);
    }
}

function start(opts) {
    opts = opts || {};

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
                    //log("RTC connection closed:" + conn.peer);
                    delete nodeMap[peer_id];
                });
            });
        });

        // Create the local raft.js node
        log("Starting Raft node");
        var node_opts = {verbose: verbose,
                         debug: debug,
                         log: log,
                         serverData: nodeMap,
                         firstServer: firstServer,
                         sendRPC: rtcSend,
                         electionTimeout: electionTimeout,
                         clientRequestResponse: clientRequestResponse};
        for (var k in opts) { node_opts[k] = opts[k] };

        node = new local.RaftServerLocal(nodeId, node_opts);

        // Start scanning for new servers
        addRemoveServersAsync();
        updateStats();
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
            //log("RTC connection closed:" + conn.peer);
            delete nodeMap[conn.peer];
        });
    });
}
