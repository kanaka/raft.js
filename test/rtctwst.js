var child_process = require('child_process'),
    Twst = require('twst').Twst,
    RtcTwst = null;

// Subclass Twst
exports.RtcTwst = RtcTwst = function(opts) {
    Twst.call(this, opts);
    this.nextPageIndex = 0;

    //rtwst.on('return',        function(idx, msg) { console.log('RETURN:', idx, msg); });
    //rtwst.on('callback',      function(idx, msg) { console.log('CALLBACK:', idx, msg); });
    this.on('error', function(idx, msg) {
        console.error(idx + ' ERROR:', msg.data);
    });
    this.on('console.log', function(idx, msg) {
        console.log(idx + ' CONSOLE.LOG:', msg.data.join(' '));
    });
    this.on('console.warn', function(idx, msg) {
        console.warn(idx + ' CONSOLE.WARN:', msg.data.join(' '));
    });
    this.on('console.error', function(idx, msg) {
        console.error(idx + ' CONSOLE.ERROR:', msg.data.join(' '));
    });
    this.on('close', function(idx, msg) {
        console.log(idx + ' CLOSE:', msg.data);
    });

    if (opts.startPages) { this.startPages(opts); }
};
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
    var self = this,
        prefix = opts.prefix || "",
        timeout = opts.timeout || 60000;
        docker_args = ['run', '-it', '-d', // '--rm',
                       '-v', process.cwd() + '/test:/test',
                       'slimerjs-wily',
                       'slimerjs', '/test/launch.js',
                       url,
                       timeout];

    console.log(prefix + 'launching slimerjs in docker');
    var out = child_process.execFileSync('docker', docker_args,
                                         {encoding: 'utf8'}),
        id = out.replace(/[\r\n]*$/,'');
    //var page = child_process.spawn('docker', docker_args);
    console.log('launched docker container ' + id);

    var page = child_process.spawn('docker', ['logs', '-t', '-f', id]);
    page.docker_id = id;
    page.on('close', function (code) {
        console.log(prefix + 'docker logs exited with code ' + code);
        if (opts.nocleanup) {
            process.exit(exitCode);
        } else {
            //this.cleanup_exit(code);
        }
    });

    if (opts.verbose) {
        page.stdout.on('data', function(chunk) {
            var line = chunk.toString('utf8').replace(/\r\n$/,'');
            if (line === '') { return; }
            console.log(prefix + line);
        });
    }
    return page;
}

RtcTwst.prototype.startPages = function(opts) {
    var self = this,
        cur_client_cnt = Object.keys(self.clients).length,
        prefix = opts.prefix + this.nextPageIndex + ': ';
    //console.log("startPages:", opts.clientCount, this.nextPageIndex, cur_client_cnt);
    if (cur_client_cnt >= opts.clientCount) {
        opts.pagesCallback();
        return;
    }
    if (this.nextPageIndex <= cur_client_cnt) {
        console.log('Starting docker client ' + this.nextPageIndex);
        self.dockerPage(opts.url, {prefix: prefix,
                                   timeout: opts.timeout,
                                   verbose: opts.verbose});
        this.nextPageIndex += 1;
    }
    setTimeout(function() { self.startPages(opts); }, 100);
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
        self.get_node_info(2000+timeout/10, function(status, nodes) {
            var elapsed = Date.now() - start_time;
            if (!status) {
                console.log("get_node_info timed out");
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
                //setTimeout(checkfn, 500);
                setTimeout(checkfn, 100);
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
            var falseStates = [],
                trueStates = [],
                trueCnt = 0;
            for (var n in data) {
                if (data[n].data) {
                    trueCnt += 1;
                    trueStates.push(n);
                } else {
                    falseStates.push(n);
                }
            }

            //console.log('Predicate data: ' + JSON.stringify(data));
            console.log('Predicate false: ' + JSON.stringify(falseStates) +
                        ', true: ' + JSON.stringify(trueStates) +
                        ', true count: ' + trueCnt);
            // Exit if cluster is up or we timeout
            if (trueCnt >= server_count) {
                callback(true, data, elapsed);
            } else if (elapsed > timeout) {
                callback(false, data, elapsed);
            } else {
                setTimeout(checkfn, 50);
                //setTimeout(checkfn, 2000);
            }
        });
    }
    checkfn();
}
