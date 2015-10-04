#!/usr/bin/env node

// Usage:
// - Start rtc_server.js first:
//   ./rtc_server.js --port 8000 --home chat.html
//
// - Now run the test using the rtc_server listen address and the
//   number of nodes:
//     node test/wait_start.js 10.0.01:8001 3

var getIP = require('twst').getIP,
    RtcTwst = require('./rtctwst').RtcTwst,
    port = 9000,
    rtc_address = process.argv[2],
    clientCount = process.argv.length >= 4 ? parseInt(process.argv[3]) : 1,
    timeout = (clientCount*20)*1000,
    channel = Math.round(Math.random()*100000),
    url = 'http://' + rtc_address +
          '/chat.html?channel=' + channel +
          '&console_logging=true' +
          '&twst_address=' + getIP() + ':' + port + '&paused=1',
    rtwst = null;

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
            rtwst.cleanup_exit(0);
        } else {
            console.log('Cluster failed to come up after ' +
                        elapsed + 'ms');
            rtwst.cleanup_exit(1);
        }
    });
}


setTimeout(function() {
    console.log("timeout waiting for clients");
    rtwst.broadcast('window.callPhantom("QUIT")');
    rtwst.cleanup_exit(1);
}, timeout);
