// Usage:
// - Start rtc_server.js first:
//   ./rtc_server --port 8000 --home chat.html
//
// - Then use a docker build of slimerjs to run the test:
//   IP_ADDR=$(hostname -I | awk '{print $1}')
//   docker run -it -v `pwd`/test/chat.js:/chat.js fentas/slimerjs slimerjs /chat.js http://${IP_ADDR}:8000/

var home = '/chat.html',
    system = require('system'),
    webpage = require('webpage'),
    channel = Math.round(Math.random()*1000000),
    base_address = system.args[1],
    server_count = (system.args.length >= 3) ? parseInt(system.args[2]) : 3,
    page_create_delay = 1,
    timeout = (10 + server_count)*1000;

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

    console.log('Opening ' + full_address);

    page.open(full_address, function(status) {
        if (status !== 'success') {
            console.log('Unable to load the address!');
            phantom.exit(1);
        }
        //var mainTitle = page.evaluate(function () {
        //    return document.title;
        //});
        callback(page);
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
        /*
        // Wait until all pages/nodes created
        if (pages.length < server_count) {
            setTimeout(checkfn, 100);
            return;
        }
        */
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
            callback(true, nodes);
        } else if (Date.now() - start_time > timeout) {
            callback(false, nodes);
        } else {
            setTimeout(checkfn, 500);
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

// Start each page/cluster node
var pcnt = 0;
function add_page() {
    var idx = pcnt;
    pcnt += 1;
    if (idx < server_count) {
        pages.push(new_page(idx, home, idx === 0, add_page));
    }
}
add_page();

// Start checking the states
wait_cluster_up(timeout, function(status, nodes) {
    if (status) {
        console.log('Cluster is up');
        show_nodes(nodes);
        phantom.exit(0);
    } else {
        console.log('Cluster failed to come up');
        show_nodes(nodes);
        phantom.exit(1);
    }
});
