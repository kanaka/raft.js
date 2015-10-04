#!/usr/bin/env node

// Usage:
// - Start rtc_server.js first:
//   ./rtc_server.js --port 8000 --home chat.html
//
// - Now run the test using the rtc_server listen address and the
//   number of nodes:
//     node test/wait_chat_propagate.js 10.0.01:8001 3 1

var getIP = require('twst').getIP,
    RtcTwst = require('./rtctwst').RtcTwst,
    port = 9000,
    //spread_msgs = true,
    spread_msgs = false,
    rtc_address = process.argv[2],
    clientCount = process.argv.length >= 4 ? parseInt(process.argv[3]) : 1,
    msgCount = (process.argv.length >= 5) ? parseInt(process.argv[4]) : 1,
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
            console.log('Delaying for 3 seconds before sending message');
            setTimeout(do_chat, 3000);
        } else {
            console.log('Cluster failed to come up after ' +
                        elapsed + 'ms');
            rtwst.cleanup_exit(1);
        }
    });
}

function do_chat() {
    rtwst.broadcast("window._test_msgCount = " + msgCount + ";")
    if (spread_msgs) {
        for (var idx=0; idx < clientCount; idx++) {
            var cnt = Math.floor((msgCount + clientCount - idx - 1) / clientCount),
                msg = 'test msg #' + idx,
                x = '';

            if (cnt === 0) { continue }

            x += 'for(var j=0; j<' + cnt + '; j++) {pendingSends.push('
            x += '"msg #" + j + " from node ' + idx + '")}';
            console.log('Sending to ' + idx + ': ' + x);
            rtwst.send(x, {id: idx})
        }
    } else {
        rtwst.get_leader_idx(2000, function(status, leader_idx) {
            var x = '';
            x += 'for(var j=0; j<' + msgCount + '; j++) {pendingSends.push('
            x += '"msg #" + j + " from leader node ' + leader_idx + '")}';
            console.log('Sending to leader node ' + leader_idx + ': ' + x);
            rtwst.send(x, {id: leader_idx})
        });
    }
    rtwst.wait_cluster_predicate(timeout, function() {
    //rtwst.wait_cluster_predicate(10000, function() {
        var sm = node._self.stateMachine;
        //console.log(nodeId + " stateMachine: " + JSON.stringify(sm));
        if ('history' in sm && 'value' in sm.history) {
            var lines = sm.history.value;
            //console.log("lines.length:", lines.length);
            if (lines.length > window._test_msgCount) {
                console.error('Too many lines (' + lines.length + ') in history!')
            } else if (lines.length === window._test_msgCount) {
                var m = lines[lines.length-1].match(/msg .* from .*node .*$/);
                //console.log("m:", m);
                return m ? true : false;
            } else {
                return false
            }
        } else {
            return false;
        }
    }, function(status, results, elapsed) {
        if (status) {
            console.log('Cluster state propagated after ' + elapsed + 'ms');
            rtwst.cleanup_exit(0);
        } else {
            console.log('Cluster state failed to propagate after ' + elapsed + 'ms')
            rtwst.cleanup_exit(1);
        }

        /*
        // TODO: remove debug
        var retcode = status ? 0 : 1;
        rtwst.collect(function() { return JSON.stringify({log: node._self.log,
                                    history: node._self.stateMachine.history.value});
        }, {timeout: timeout}, function(status, data) {
            if (status) {
                console.log("DEBUG collect data:", JSON.stringify(data));
            } else {
                console.log("DEBUG collect failed");
            }
            rtwst.cleanup_exit(retcode);
        });
        */
    });
}

setTimeout(function() {
    console.log("timeout waiting for clients");
    rtwst.broadcast('window.callPhantom("QUIT")');
    rtwst.cleanup_exit(1);
}, timeout);
