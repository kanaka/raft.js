# Raft.js: Raft Consensus Algorithm in JavaScript

Raft.js is an implementation of the Raft consensus algorithm in
JavaScript. The Raft algorithm was developed by Diego Ongaro and John
Ousterhout at Stanford University. Please refer to their excellent
paper on Raft: ["In Search of an Understandable Consensus
Algorithm"](https://ramcloud.stanford.edu/wiki/download/attachments/11370504/raft.pdf).


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

## Status

The following features of the Raft algorithm have been implemented:

* Leader Election
* Log replication and persistence
* Safety features (except for one aspect related to server crashes)
* Client interaction
* local in process RPCs

## TODO

* implement second safety check (current term) on commit
* membership change
* socket based RPCs/communication
* faster resend of appendEntries when follower responds with fail
  (nextIndex update)
* faster re-issue of requestVote to non-responders
* more exception handling
* in depth testing
* log compaction
