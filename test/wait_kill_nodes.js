#!/usr/bin/env node

// Usage:
// - Start rtc_server.js first:
//   ./rtc_server.js --port 8000 --home chat.html
//
// - Now run the test using the rtc_server listen address and the
//   number of nodes:
//     node test/wait_kill_nodes.js 10.0.01:8001 3 1

var getIP = require('twst').getIP,
    RtcTwst = require('./rtctwst').RtcTwst,
    port = 9000,
    rtc_address = process.argv[2],
    clientCount = process.argv.length >= 4 ? parseInt(process.argv[3]) : 1,
    killCount = (process.argv.length >= 5) ? parseInt(process.argv[4]) : parseInt((clientCount-1)/2, 10),
    timeout = (clientCount*20)*1000,
    channel = Math.round(Math.random()*100000),
    url = 'http://' + rtc_address +
          '/chat.html?channel=' + channel +
          '&console_logging=true' +
          '&twst_address=' + getIP() + ':' + port + '&paused=1',
    rtwst = null;

if (killCount > parseInt((clientCount-1)/2, 10)) {
    console.log('Kill count must be less than half of client count');
    process.exit(2);
}

rtwst = new RtcTwst({port: port,
                     startPages: true,
                     url: url,
                     prefix: 'p',
                     timeout: timeout,
                     clientCount: clientCount,
                     pagesCallback: delay_do_start});

function delay_do_start() {
    console.log('All clients started, delaying for 5 seconds before starting cluster');
    setTimeout(do_start, 5000);
}

function do_start() {
    rtwst.broadcast('startChat()');
    rtwst.wait_cluster_up(timeout, function(status, nodes, elapsed) {
        if (status) {
            console.log('Cluster is up after ' + elapsed + 'ms');
            console.log('Delaying for 3 seconds before killing node(s)');
            setTimeout(do_kill, 3000);
        } else {
            console.log('Cluster failed to come up after ' +
                        elapsed + 'ms');
            rtwst.cleanup_exit(1);
        }
    });
}

function do_kill() {
    console.log('Removing ' + killCount + ' nodes/pages (including the leader)');

    rtwst.get_leader_idx(2000, function(status, leader_idx) {
        if (!status) {
            console.log('Could not determine cluster leader');
            rtwst.cleanup_exit(1);
            return;
        }
        console.log('Removing page index ' + leader_idx + ' (current leader)');
        rtwst.remove(leader_idx);

        for (var j=0; j<killCount-1; j++) {
            var cids = Object.keys(rtwst.clients),
                kill_id = cids[parseInt(Math.random()*cids.length, 10)];
            console.log('Removing page index ' + kill_id);
            rtwst.remove(kill_id);
        }

        console.log('Waiting for cluster to stabilize');
        rtwst.wait_cluster_up(timeout, function(status, nodes, elapsed) {
            if (status) {
                console.log('Cluster recovered after ' + elapsed + 'ms');
                rtwst.cleanup_exit(0);
            } else {
                console.log('Cluster failed to recover after ' + elapsed + 'ms');
                rtwst.cleanup_exit(1);
            }
        });
    });
}

setTimeout(function() {
    console.log("timeout waiting for clients");
    rtwst.broadcast('window.callPhantom("QUIT")');
    rtwst.cleanup_exit(1);
}, timeout);
