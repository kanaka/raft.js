var webpage = require('webpage');

exports.new_page = function (page_idx, firstServer, opts, callback) {
    var query = '?channel='+ opts.channel + '&console_logging=true';

    console.log("new_page: " + Date.now());
    var page = webpage.create();

    // Register external handlers
    page.onConsoleMessage = function (msg, line, origin) {
        console.log('CONSOLE ' + page_idx + ': ' + msg);
    };
    page.onCallback = function(msg) {
        console.log('CALLBACK ' + page_idx + ': ' + msg);
        if (msg === 'QUIT') {
            console.log('Normal exit');
            slimer.exit(0);
        }
    };

    var full_address = opts.base_address;

    if (!firstServer) {
        full_address += opts.home;
    }
    full_address += query + (firstServer ? '#firstServer' : '');

    console.log('Opening ' + page_idx + ': ' + full_address);

    page.open(full_address, function(status) {
        if (status !== 'success') {
            console.log('Unable to load the address!');
            phantom.exit(1);
        }
        //var mainTitle = page.evaluate(function () {
        //    return document.title;
        //});
        if (callback) { callback(page); }
    });

    return page;
}

exports.get_node_info = function (pages, full) {
    var nodes = [];
    for (var i=0; i < pages.length; i++) {
        nodes.push(pages[i].evaluate(function(full) {
            // Evaluates in page context so 'node' variable is implicit
            if (typeof node !== 'undefined' && node) {
                var data = {id: node._self.id,
                            state: node._self.state,
                            serverMapKeys: Object.keys(node._self.serverMap)};
                if (full) {
                    data.stateMachine = node._self.stateMachine;
                    data.log = node._self.log;
                }
                return data;
            } else {
                return null;
            }
        }, full));
    }
    return nodes;
}

exports.get_leader_idx = function(nodes) {
    for (var i=0; i < nodes.length; i++) {
        if (nodes[i].state === 'leader') { return i; }
    }
}

exports.show_nodes = function (nodes) {
    for (var i=0; i < nodes.length; i++) {
        console.log('Node ' + i + ': ');
        console.log(JSON.stringify(nodes[i], null, 2));
    }
}

exports.wait_cluster_up = function (pages, server_count, timeout, callback) {
    var start_time = Date.now();
    var checkfn = function () {
        // Gather data from the nodes
        var nodes = exports.get_node_info(pages, false);

        // Pull out some stats
        var states = {leader:[], candidate:[], follower:[]},
            nodeCnts = [];
        for (var i=0; i < pages.length; i++) {
            var node = nodes[i];
            if (node) {
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
            callback(true, nodes, Date.now() - start_time);
        } else if (Date.now() - start_time > timeout) {
            callback(false, nodes, Date.now() - start_time);
        } else {
            setTimeout(checkfn, 500);
        }
    }
    checkfn();
}

exports.wait_cluster_predicate = function(pages, server_count, timeout, predicate, callback) {
    var start_time = Date.now();
    var checkfn = function () {
        // Gather data from the nodes
        var results = [];
        for (var i=0; i < pages.length; i++) {
            results.push(pages[i].evaluate(predicate));
        }

        var trueCnt = results.reduce(function(a,b) {return a+(b?1:0)}, 0);
        console.log('Predicate results: ' + JSON.stringify(results) +
                    ', true count: ' + trueCnt);
        // Exit if cluster is up or we timeout
        if (trueCnt >= server_count) {
            callback(true, results, Date.now() - start_time);
        } else if (Date.now() - start_time > timeout) {
            callback(false, results, Date.now() - start_time);
        } else {
            setTimeout(checkfn, 25);
        }
    }
    checkfn();
}

