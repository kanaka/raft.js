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

    > t.serverPool[lid].clientRequest({op:"set",key:'a',value:1}, function(results) { console.log("results: ", results); });
    > t.getAll('log');
    > t.getAll('stateMachine');
    > t.serverPool[lid].clientRequest({op:"get",key:'a',ro:1}, function(results) { console.log("results: ", results); });


## Example: Three Raft Servers Communicating via HTTP

In this example, three raft servers are created in the same process
but they communicate with each other by sending messages over HTTP.

    node
    > t = require('./test_http');
    > t.startHttp({debug:true});

    > lid = t.getLeaderId();
    > t.getAll('log');

    > t.serverPool[lid].clientRequest({op:"set",key:'a',value:1}, function(results) { console.log("results: ", results); });
    > t.getAll('log');
    > t.getAll('stateMachine');
    > t.serverPool[lid].clientRequest({op:"get",key:'a',ro:1}, function(results) { console.log("results: ", results); });

## Status

The following features have been implemented (the section number of
the Raft paper is listed in brackets):

* [5.2] Leader election
* [5.3] Log replication and persistence
* [5.4, 5.5, 5.6, 5.7] Safety features
* [7.1] Client interaction (except filtering duplicates)
* [5.1] RPCs:
 * In-process (direct function calls) for quick testing
 * Over HTTP

## TODO

* [6] membership change (joint consensus)
* [7.1] filter duplicate client requests
* [7.2] log compaction
* faster resend of appendEntries when follower responds with fail
  (nextIndex update)
* faster re-issue of requestVote to non-responders
* more exception handling
* in depth testing
