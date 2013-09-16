# Raft.js: Raft Consensus Algorithm in JavaScript

Raft.js is an implementation of the Raft consensus algorithm in
JavaScript. The Raft algorithm was developed by Diego Ongaro and John
Ousterhout at Stanford University. Please refer to their excellent
paper on Raft: ["In Search of an Understandable Consensus
Algorithm"](https://ramcloud.stanford.edu/wiki/download/attachments/11370504/raft.pdf).


## Example

Start a node REPL and require one of the test modules.

    > t = require('./test_local');
    # OR
    > t = require('./test_http');

The local test module starts servers in the same process that
communicate directly with function calls. The http test creates
servers in the same process but they communicate with each other by
sending messages over HTTP.

Start 3 servers (an optional second argument specifies the number of
servers to start):

    > t.startServers({debug:true});

Get the leader ID and show its entry log:

    > lid = t.getLeaderId();
    > t.getAll('log')[lid];

Set a key/value in the state machine, show the log and
stateMachine for all the servers, then read back the value:

    > t.serverPool[lid].clientRequest({op:"set",key:'a',value:1}, function(results) { console.log("results: ", results); });
    > t.getAll('log');
    > t.getAll('stateMachine');
    > t.serverPool[lid].clientRequest({op:"get",key:'a',ro:1}, function(results) { console.log("results: ", results); });

Add a new server (ID 3), set a different value and show that it
has propagated to all the server state machines:

    > t.addServer(3,{debug:true});
    > t.serverPool[lid].clientRequest({op:"set",key:'b',value:2}, function(results) { console.log("results: ", results); });
    > t.getAll('stateMachine');

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
* [6] Membership change / joint consensus

## TODO

* [7.1] filter duplicate client requests
* [7.2] log compaction
* faster resend of appendEntries when follower responds with fail
  (nextIndex update)
* faster re-issue of requestVote to non-responders
* more exception handling
* in depth testing


## License

Licensed under [MPL-2.0](http://www.mozilla.org/MPL/2.0/). See
LICENSE.txt.
