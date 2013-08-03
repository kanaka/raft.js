# JavaScript implementation of the Raft Consensus Algorithm


## Example: Three Local Raft Servers

In this example, three raft servers are created in the same process
and communicate directly with function calls.

    node
    > t = require('./test_local');
    > t.startTest({debug:true});

    > lid = t.getLeaderId();
    > t.getAll('log');

    > t.local._serverPool[lid].clientRequest(function(sm) { sm.XXX = 'YYY'; console.log("sm:", sm); return "done"; }, function(results) { console.log("results: ", results); });
