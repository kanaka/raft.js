var spawn = require('child_process').spawn,
    Twst = require('twst').Twst,
    RtcTwst = null;

// Subclass Twst
exports.RtcTwst = RtcTwst = function(opts) { Twst.call(this, opts); };
RtcTwst.prototype = Object.create(Twst.prototype);
RtcTwst.prototype.constructor = RtcTwst;

RtcTwst.prototype.cleanup_exit = function(exitCode) {
    console.log("Cleaning up and exiting with code " + exitCode);
    this.broadcast('window.callPhantom("QUIT")');
    setTimeout(function() {
        process.exit(exitCode);
    }, 1000);
}

RtcTwst.prototype.dockerPage = function(url, opts) {
    opts = opts || {};
    var prefix = opts.prefix || "";
    var timeout = opts.timeout || 60000;
    var docker_args = ['run', '-it', '--rm',
        '-v', process.cwd() + '/test:/test',
        'slimerjs-wily',
        'slimerjs', '/test/launch.js',
        url,
        timeout];

    console.log(prefix + 'launching slimerjs in docker');
    var page = spawn('docker', docker_args);

    page.stdout.on('data', function(chunk) {
        var line = chunk.toString('utf8').replace(/\r\n$/,'');
        if (line === '') { return; }
        console.log(prefix + line);
    });

    page.on('close', function (code) {
        console.log(prefix + 'docker container exited with code ' + code);
        cleanup_exit(this, code);
    });
    return page;
}

////////////////////////////////////
// RTC specific

RtcTwst.prototype.get_node_info = function(timeout, callback) {
    this.collect(function() {
        // Evaluates in page context so 'node' variable is implicit
        if (typeof node !== 'undefined' && node) {
            var data = {id: node._self.id,
                        state: node._self.state,
                        serverMapKeys: Object.keys(node._self.serverMap)};
            return data;
        } else {
            return null;
        }
    }, {timeout: timeout}, callback);
}

RtcTwst.prototype.get_leader_idx = function(timeout, callback) {
    var self = this;
    self.get_node_info(timeout, function(status, nodes) {
        if (status) {
            for (var cid in nodes) {
                var node = nodes[cid].data;
                if (node.state === 'leader') {
                    callback(true, cid);
                    return;
                }
            }
            callback(false, null);
        } else {
            callback(false, null);
        }
    });
}

RtcTwst.prototype.wait_cluster_up = function(timeout, callback) {
    var self = this,
        server_count = Object.keys(self.clients).length,
        start_time = Date.now();
    var checkfn = function () {
        // Gather data from the nodes
        self.get_node_info(2000, function(status, nodes) {
            var elapsed = Date.now() - start_time;
            if (!status) {
                callback(false, nodes, elapsed)
            }
            // Pull out some stats
            var states = {leader:[], candidate:[], follower:[]},
                nodeCnts = [];
            for (var i in nodes) {
                var node = nodes[i].data;
                if (node) {
                    //console.log("node:", node, "node.state:", node.state);
                    states[node.state].push(i);
                    nodeCnts.push(node.serverMapKeys.length);
                } else {
                    nodeCnts.push(0);
                }
            }
            var totalNodeCnt = nodeCnts.reduce(function(a,b) {return a+b}, 0);
            console.log('Cluster states: ' + JSON.stringify(states) +
                        ', node counts: ' + JSON.stringify(nodeCnts));
            // Exit if cluster is up or we timeout
            if (states.leader.length === 1 &&
                states.candidate.length === 0 &&
                states.follower.length === server_count-1 &&
                totalNodeCnt === server_count*server_count) {
                callback(true, nodes, elapsed);
            } else if (elapsed > timeout) {
                callback(false, nodes, elapsed);
            } else {
                setTimeout(checkfn, 500);
            }
        });
    }
    checkfn();
}

RtcTwst.prototype.wait_cluster_predicate = function(timeout, predicate, callback) {
    var self = this,
        server_count = Object.keys(self.clients).length,
        start_time = Date.now();
    var checkfn = function () {
        self.collect(predicate, {timeout: timeout}, function(status, data) {
            var elapsed = Date.now() - start_time;
            if (!status) {
                callback(false, data, elapsed)
            }
            var trueCnt = 0;
            for (var n in data) {
                if (data[n].data) { trueCnt += 1; }
            }

            console.log('Predicate results: ' + JSON.stringify(data) +
                        ', true count: ' + trueCnt);
            // Exit if cluster is up or we timeout
            if (trueCnt >= server_count) {
                callback(true, data, elapsed);
            } else if (elapsed > timeout) {
                callback(false, data, elapsed);
            } else {
                setTimeout(checkfn, 25);
                //setTimeout(checkfn, 2000);
            }
        });
    }
    checkfn();
}
