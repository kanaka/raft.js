#!/usr/bin/env node

// To use this, first start an rtc_server.js signalling server (i.e.
// running at 10.0.0.1:8001). Then start this test:
//     node test/wait_start.js 10.0.01:8001 3

var RtcTwst = require('./rtctwst').RtcTwst,
    rtwst = new RtcTwst(),
    rtc_address = process.argv[2],
    clientCount = process.argv.length >= 4 ? parseInt(process.argv[3]) : 1,
    timeout = (clientCount*20)*1000;

//var url = 'http://192.168.2.3:9000/test/index.html';
var channel = Math.round(Math.random()*100000);
var url = 'http://' + rtc_address +
          '/rtc.html?channel=' + channel +
          '&twst_address=' + rtwst.getAddress() + '&paused=1';

var pages = [];

for (var i=0; i<clientCount; i++) {
    pages.push(rtwst.dockerPage(url, {prefix: 'p' + i + ': ',
                                      timeout: timeout}));
}

function poll() {
    if (Object.keys(rtwst.clients).length >= clientCount) {
        console.log('Delaying for 5 seconds before starting cluster');
        setTimeout(function() {
            console.log('Starting cluster at:', Date.now());
            rtwst.broadcast('start();');
            rtwst.wait_cluster_up(timeout, function(status, nodes, elapsed) {
                if (status) {
                    console.log('Cluster is up after ' + elapsed + 'ms');
                    console.log('Cluster up at:', Date.now());
                    rtwst.cleanup_exit(0);
                } else {
                    console.log('Cluster failed to come up after ' +
                                elapsed + 'ms');
                    rtwst.cleanup_exit(1);
                }
            });
        }, 5000);
    } else {
        setTimeout(poll, 100);
    }
}
poll();


setTimeout(function() {
    console.log("timeout waiting for clients");
    rtwst.broadcast('window.callPhantom("QUIT")');
    rtwst.cleanup_exit(1);
}, timeout);
