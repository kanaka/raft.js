// Usage:
// - Start rtc_server.js first:
//   ./rtc_server --port 8000
//
// - Then use a docker build of slimerjs to run the test:
//   IP_ADDR=$(hostname -I | awk '{print $1}')
//   docker run -it -v `pwd`/test/rtc.js:/rtc.js fentas/slimerjs slimerjs /rtc.js http://${IP_ADDR}:8000/

var home = '/rtc.html',
    system = require('system'),
    webpage = require('webpage'),
    channel = Math.round(Math.random()*1000000),
    base_address = system.args[1],
    server_count = (system.args.length >= 3) ? parseInt(system.args[2]) : 3,
    page_create_delay = 1,
    up_timeout = (10 + (server_count*server_count)/4)*1000;
    pred_timeout = (1 + (server_count*server_count)/6)*1000;

var query = '?channel='+ channel + '&console_logging=true';

var pages = [];

function new_page(page_id, home, firstServer, callback) {
    console.log("new_page: " + Date.now());
    var page = webpage.create();

    // Register external handlers
    page.onConsoleMessage = function (msg, line, origin) {
        console.log('CONSOLE ' + page_id + ': ' + msg);
    };
    page.onCallback = function(msg) {
        console.log('CALLBACK ' + page_id + ': ' + msg);
        if (msg === 'QUIT') {
            console.log('Normal exit');
            slimer.exit(0);
        }
    };

    var full_address = base_address;

    if (!firstServer) {
        full_address += home;
    }
    full_address += query + (firstServer ? '#firstServer' : '');

    console.log('Opening ' + page_id + ': ' + full_address);

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

// Evaluates in page context so 'node' variable is implicit
function get_node_info(full) {
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
}

function wait_cluster_up(timeout, callback) {
    var start_time = Date.now();
    var checkfn = function () {
        // Gather data from the nodes
        var nodes = [];
        for (var i=0; i < pages.length; i++) {
            nodes.push(pages[i].evaluate(get_node_info));
        }

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
            //console.log('Saving image /tmp/chat' + i + '.png');
            //page.render('/tmp/chat' + i + '.png');
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

function wait_cluster_predicate(predicate, timeout, callback) {
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

function show_nodes(nodes) {
    for (var i=0; i < server_count; i++) {
        console.log('Node ' + i + ': ');
        console.log(JSON.stringify(nodes[i], null, 2));
    }
}

// Start checking the states
wait_cluster_up(timeout, function(status, nodes) {
    if (status) {
        console.log('Cluster is up after ' + elapsed + 'ms');
        //show_nodes(nodes);

        phantom.exit(0);
    } else {
        console.log('Cluster failed to come up after ' + elapsed + 'ms');
        //show_nodes(nodes);
        phantom.exit(1);
    }
});

// Start each page/cluster node
pages.push(new_page(0, home, true, function() {
    for (var idx = 1; idx < server_count; idx++) {
        pages.push(new_page(idx, home, false));
    }
}));
