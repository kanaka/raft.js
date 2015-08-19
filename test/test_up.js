// Usage:
// - Start rtc_server.js first:
//   ./rtc_server --port 8000
//
// - Then use a docker build of slimerjs to run the test:
//   IP_ADDR=$(hostname -I | awk '{print $1}')
//   docker run -it -v `pwd`/test:/test slimerjs-0.9.6 slimerjs /test/test_up.js http://${IP_ADDR}:8000/

var common = require('common'),
    system = require('system'),
    home = '/rtc.html',
    channel = Math.round(Math.random()*1000000),
    base_address = system.args[1],
    server_count = (system.args.length >= 3) ? parseInt(system.args[2]) : 3,
    up_timeout = (10 + (server_count*server_count)/4)*1000;
    pred_timeout = (1 + (server_count*server_count)/6)*1000;

var pages = [];

// Start checking the states
common.wait_cluster_up(pages, server_count, up_timeout, function(status, nodes, elapsed) {
    if (status) {
        console.log('Cluster is up after ' + elapsed + 'ms');
        //common.show_nodes(nodes);

        phantom.exit(0);
    } else {
        console.log('Cluster failed to come up after ' + elapsed + 'ms');
        //common.show_nodes(nodes);
        phantom.exit(1);
    }
});

// Start each page/cluster node
var opts = {base_address: base_address, home: home, channel: channel};
pages.push(common.new_page(0, true, opts, function() {
    for (var idx = 1; idx < server_count; idx++) {
        pages.push(common.new_page(idx, false, opts));
    }
}));
