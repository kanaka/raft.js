// Usage:
// - Start rtc_server.js first:
//   ./rtc_server --port 8000 --home chat.html
//
// - Then use a docker build of slimerjs to run the test:
//   IP_ADDR=$(hostname -I | awk '{print $1}')
//   docker run -it -v `pwd`/test:/test slimerjs-0.9.6 slimerjs /test/test_chat_propagate.js http://${IP_ADDR}:8000/

var common = require('common'),
    system = require('system'),
    home = '/chat.html',
    channel = Math.round(Math.random()*1000000),
    base_address = system.args[1],
    server_count = (system.args.length >= 3) ? parseInt(system.args[2]) : 3,
    kill_count = (system.args.length >= 4) ? parseInt(system.args[3]) : parseInt((server_count-1)/2, 10),
    up_timeout = (10 + (server_count*server_count)/4)*1000;
    pred_timeout = (1 + (server_count*server_count)/6)*1000;

var pages = [];

if (kill_count > parseInt((server_count-1)/2, 10)) {
    console.log('Kill count must be less than half of server count');
    phantom.exit(2);
}

// Start checking the states
common.wait_cluster_up(pages, server_count, up_timeout, function(status, nodes, elapsed) {
    if (status) {
        console.log('Cluster is up after ' + elapsed + 'ms');
        //common.show_nodes(nodes);

        console.log('Removing ' + kill_count + ' nodes/pages (including the leader)');

        var leader_idx = common.get_leader_idx(common.get_node_info(pages));

        console.log('Removing page index ' + leader_idx + ' (current leader)');
        pages[leader_idx].close();
        pages.splice(leader_idx, 1); // NOTE: mutates pages array in place

        for (var j=0; j<kill_count-1; j++) {
            var kill_idx = parseInt(Math.random()*kill_count, 10);
            console.log('Removing page index ' + kill_idx);
            pages[kill_idx].close();
            pages.splice(kill_idx, 1); // NOTE: mutates pages array in place
        }

        console.log('Waiting for cluster to stabalize');
        common.wait_cluster_up(pages, server_count-kill_count, up_timeout, function(status, nodes, elapsed) {
            if (status) {
                console.log('Cluster recovered after ' + elapsed + 'ms');
                phantom.exit(0);
            } else {
                console.log('Cluster failed to recover after ' + elapsed + 'ms');
                phantom.exit(1);
            }
        });
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
