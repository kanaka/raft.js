# JavaScript implementation of the Raft Consensus Algorithm


## Example: Three Local Raft Servers

In this example, three raft servers are created in the same process
and communicate directly with function calls.

    node
    > t = require('./test_local');
    > t.startLocalDurable({debug:true});  // persist to disk store

    > lid = t.getLeaderId();
    > t.getAll('log');

    > t.local._serverPool[lid].clientRequest(["set", 'a', 1], function(results) { console.log("results: ", results); });
    > t.getAll('log');
