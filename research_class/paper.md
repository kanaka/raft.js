# Raft Distributed Consensus Algorithm over WebRTC (Web Real-Time Communication) #

## Abstract ##

## 1. Introduction ##

In the past few years, browsers have quickly evolved from document
rendering engines into powerful platforms for building sophisticated
applications. Modern browsers are integrating new protocols for
communication including WebSockets for full-duplex browser-to-server
communication and WebRTC for direct browser-to-browser communication.
These new capabilities enable software developers to create
distributed network applications with browser applications as first
class citizens.

These new browser capabilities also bring with them the traditional
challenges of building reliable distributed applications such as:
concurency, security, scalability, naming, discovery, replication,
relocation, etc. The solutions to many of these challenges involve
the proper management of distributed state. Distributed consensus is
one category of distributed state management in which multiple nodes
must come to agreement on the state of single value or set of values.
The grandparent of distributed consensus algorithms is the Paxos
algorithm described by Leslie Lamport. However, Paxos has been
notoriously difficult to understand and to implement correctly. Raft
is a more recent distributed consensus algorithm that aims for
understandability and practicality of implementation.

In this study we will explore an implementation of the Raft protocol
in a browser context using WebRTC as the communication channel. We
will describe the results of the implementation and look at some of
unique challenges (and opportunities) we encountered with the
implementation. We will also explore some ideas for further study.

## 2. Use Cases ##

The traditional use of distributed consensus is in the data-center
(private or cloud based) especially as the core coordination component
of a replicated data-storage system. In these examples, the set of
nodes that compose the cluster tend to be fairly static and changes to
cluster membership are usually for the purpose of replacing nodes.
Changes to the long term size of the cluster are uncommon.

Most existing distributed browser applications are extensions of this
model in which browsers connect to load-balanced web servers which are
in close network proximity to the distributed consensus cluster. The
backend web system delivers the web application to the browser and
also serves as the conduit for all browser-to-browser communication
and state management.

However, it is not always desirable for application messages and state
to traverse the server back-end for various reasons including the
following:
- security (privacy): application state and user messages may need to
  traverse directly from browser to browser rather than traversing
  through a server.
- locality: the nature of the application may allow clusters of
  applications that are nearby on a network (e.g. intranet) to
  communicate and coordinate directly rather than passing all messages
  and state through a server back-end which may be considerable more
  remote.
- bandwidth and scale: a distributed browser based application may be
  able to avoid expensive bandwidth into and out of the backend
  data-center by passing messages and state directly between browsers.
  Depending on the design of the appication this may also enable
  better scalability then a more centralized model.

Here are some specific use cases in which Raft over WebRTC may be
applicable:
- Consistent order secure chat: a chat room system where all users see
  the same message order but messages never traverse through a central
  server even though the application code itself is delivered from
  a central web service.
- Private multi-user document editing/whiteboard system: Google
  Docs among other systems has demonstrated a powerful model for
  collaborative document creation. However, these systems all user
  central web services to coordinate shared state and handle
  brower-to-browser communication. Using a Raft over WebRTC could
  enable tools with similar functionality but without the central
  coordnation and communication.
- Browser based network games: most network games have certain states
  that must be agreed upon by all nodes (e.g. avatar dead or alive,
  etc). This can be achieved with Raft over WebRTC without requiring
  any data to traverse a central server. In addition to reducing
  browser to server bandwidth requirements, this may also allow lower
  latency gaming if games instances are partitioned by latency
  locality.

## 3 Background ##

### 3.1 Raft ###

Raft is a new distributed consensus algorithm designed to be
understandable and practical without sacrificing safety and
correctness.

The Raft algorithm breaks the problem of consensus into three core
subproblems: leader election, log replication, and safety. A full Raft
solution must also address: cluster membership changes, log
compaction, and client interaction. The Raft algorithm implemented and
discussed in this paper is based on "Consensus: Bridging Theory and
Practice" by Diego Ongaro (PhD Dissertation) TODO/CITE.

The Raft protocol is based on the concept of a distrubted transaction
log. Entries in the log represent a sequence of changes to an internal
state machine. If all members of the Raft cluster have the same log
entries, then their state machine on each node will have exactly the
same state. Each node of a Raft cluster can be in one of three states:
follower, candidate, or leader. The responsibility of the leader is to
accept new transaction log entries and then replicated these entries
in the same order to all other members of the cluster. The leader is
the only member of the cluster that may make changes to the
transaction log. In order to maintain leadership, the leader sends
heartbeat RPCs to all the followers in the cluster. Followers that
do not receive a heartbeat RPC within a certain time period become
candidates and attempt to be elected by the other nodes as the new
leader of the cluster.

#### 3.1.1 Leader Election ####

Each node of the Raft cluster maintains an ordinally increasing
current term value. When a Raft follower node does not receive
a heartbeat from a leader within a random election timeout period, it
transitions to candidate state, votes for itself, increases its
current term value by one and sends a requestVote RPC (with the
new term) to all the other nodes in the cluster. When a node receives
a requestVote RPC with a term that is greater than its own it will
become a follower (if not already), update its term to the new term,
and send a RPC response back that indicates a vote for that candidate.
However, a node may only vote for one candidate in a given term. If
a candidate receives votes from more than half of the cluster, then it
immediately becomes a leader and sends out a appendEntries RPC to
confirm leadership and reset the election timers on all the other
nodes.

#### 3.1.2 Log Replication ####

Each Raft node maintains a transaction log. The entries in the
transaction log each contain a term value in addition to the action to
apply to the state machine. Each node also keep track of the most
recent log entry which is known to be committed (exists on more than
half the nodes in the cluster).

When a new leader is elected, it begins sending appendEntries RPCs
to other nodes in the Raft cluster. These RPC messages contain
information about the state of its transaction log: index and term of
the latest entry, and the most recently committed entry. If the node
does not have an entry matching the most recent entry on the leader,
then it replies with false to indicate that its log and not up to
date. The next appendEntries RPC that the leader sends to that
node will contain the next oldest index and term. This will continue
until the leader discovers the latest log entry which is agreement
(the node may not have any entries if it is new). Then the leader will
begin to propogate entries to the node in subsequent appendEntries
RPCs until the node is caught up. The leader continues sending
empty appendEntries as heartbeat RPCs to all the nodes until it
receives a new entry in its transaction log from a client.

#### 3.1.3 Safety ####

In order to ensure that each state machine on every node executes
exactly the same commands in exactly the same order, the Raft system
provides safety guarantees. In particular, there are some restrictions
on which Raft nodes are actually eligible to become a leader based on
the state of their transaction log compared to other node transaction
logs. A Raft node will only vote for a candidate if the candidate has
a log that is more up-to-date than the voter. A log entry with a later
term is always more up-to-date. If the log entries have the same term,
then the entry with a higher index is more up-to-date. In addition,
Raft leaders may not consider entries from a previous term to be
committed until it has committed at least one an entry from its own
term.

Raft nodes must also persist certain properties to durable storage
before sending or receiving any RPCs. The properties that must be
persisted are current term, current vote for this term (if any), and
either the full transaction log or the state machine plus any
unapplied transaction log entries.

#### 3.1.4 Membership Changes ####

Raft leverages the replicated transaction log to accomplish live
cluster membership changes. Membership changes are accomplished by
adding or removing one Raft node at a time using special add/remove
log entries. As soon as the new entry is added to the log it becomes
effective without waiting for the entry to be fully committed across
the cluster. However, a new cluster change entry may not be added to
the log until the previous one is committed. Once the change entry is
committed, the initiator of the change is notified, removed servers
can be shut down and another change entry may be added to the log.

#### 3.1.5 Log Compaction ####

In order to keep the replicated transaction log from growing
indefinitely, Raft nodes should periodically compact their logs. There
are many different ways to accomplish log compaction and the best way
will depend on application requirements and on the specific nature of
the distributed state machine. For example, if the state machine is
simply a single shared counter, then any log entries before the most
recently committed entry may be safely discarded. The simplest and
most generic solution is often to provide some way of snapshotting the
entire state machine (including the term and log index it represents)
to disk at which point the all previously applied log entries can be
discarded. Snapshotting the state machine also means that the
implementation must provide a way for the leader to serialize and send
the current state machine to other nodes if their transaction log is
too old (e.g. when a new node is added).


#### 3.1.6 Client Interaction ####

Clients of the Raft cluster are able to interact with the distributed
tate machine by sending RPCs to the leader in order to add command
entries to the transaction log. Clients first find the address of any
node in the cluster either via broadcast or via an external directory
service. Once the client discovers a node of the cluster, that node
can either forward messages directly to the leader node (if it is not
the leader) or it can reject client requests with a response
indicating the address of the leader for the client to redirect to.

The Raft protocol should also provide strict linearizable semantics for
client commands/requests (reads and writes). In order to accomplish
this, each client is given a unqiue ID, and the client assigns
a unique serial number to each command. This prevents a single client
command from being applied twice to the state machine (in case of
a leader crash, or network duplication).

Linearizability is important not just for writes/updates to the state
machine, but also for reads, which means that read requests must also
be entered as transactions in the log and committed to more than half
the Raft nodes before the leader can respond to the client. If reads
bypass the transaction log then those reads are serializable but not
necessarily linearizable. For example, a leader may have been deposed
and not realize it if the cluster is partitioned which could result in
reads of stale data (the leader of the larger partition may have
already committed new entries).


### 3.2 Raft.js ###

Raft.js is an implementation of the Raft algorithm in JavaScript that
was creator by the author of this paper TODO/CITE. Raft.js is designed
to run in either a browser environment or within node.js (server-side
JavaScript). Raft.js implements the Raft algorithm as described in
"Consensus", Ongaro (dissertation TODO/CITE).

The full algorithm is implemented except for log compaction and full
client linearizability (clients and client requests are not yet
assigned unique IDs). These features are planned for the future.

#### 3.2.1 Modular Design ####

The implementation of the Raft algorithm is implemented in the
RaftServerBase class (in base.js). The base class does not directly
implement stateful functions such as RPC communcation, durable
storage, scheduling/timeouts, or state machine command/management. In
order to create a working implementation these functions must be
provided either as configuration parameters when the class is
instantiated or by sub-classing the class.

The modular design of the Raft.js implemenation allows it to be easily
used in several different contexts. For example, the RaftServerLocal
class (local.js) implements RPC calls using plain JavaScript function
calls between different instances of the class (nodes) in the same
execution context. The online Raft visualization at
http://kanaka.github.io/raft.js/ uses the RaftServerLocal class and
instantiates it using a scheduling functions that fire when the user
clicks on the "Step" button rather than due to the passage of time.

The RaftServerHttp class (http.js) embeds a simple web server into
each Raft node and then uses normal HTTP requests to send RPC messages
between Raft nodes.

For this paper, the RaftServerLocal class was extended with the
capability of sending RPCs over the WebRTC Data Channel.

#### 3.2.2 Differences from Raft

- reject config changes if one is already in progress (push complexity
  out of the cluster algorithm itself)
- WebRTC is messages based, rather than request/repsonse. Turn
  response RPC into full RPCs (pass sender as part of response so it
  can be correlated properly).
- the Raft paper/protocol has undergone some revisions (including
  incorporation of suggestions by myself): cluster membership
  simplifications, separating commit and apply concepts, etc.
- does not implement log compaction
- does not assign client and transaction IDs yet.

### 3.3 WebRTC ###


#### 3.3.1 Peer-to-Peer ####

- STUN
- TURN

#### 3.3.2 Signaling ####

- SDP
- ORTC

#### 3.3.3 DataChannel ####

- Data Channel
- getUserMedia

### 3.4 PeerJS ###

#### 3.4.1 PeerJS Server ####

#### 3.4.2 PeerJS Client Library ####

### 4 Implementation / Design ###

#### 4.1 Server ####

- bootstrapping: well known address to create a new cluster/channel
    - new channel
    - first server

#### 4.2 Client ####

- addRemoveServersAsync
  - should removes or adds be prioritized?

### 5 Results ###

- adding and removing
- setTimer/requestAnimantionFrame slower in background frames

### 6 Next Steps ###

- Use alternate WebRTC modes (e.g. out of order and/or non-guaranteed
  delivery)
- Have server be a peer and participate
- what about going from 2 nodes to 1 node? Asymmetric with going from
  1 to 2 nodes.
    - 2 nodes -> 1 node: tie breaker (non-equal votes?)
- Timeout and remove nodes without server notification
- Forward client requests rather than redirect (since client would
  need to go over WebRTC channel anyways)
- Implement a chat system
- Test system survival without presence of server
- Larger scale deployments on multiple systems
- Cross-browser testing
- Raft log compaction
- separate the consensus data from the latency sensitive or bulky
  data. Might have consensus data use hashes to the real data for
  consensus with performance.

### 7 Conclusions ###

- open source

### 8 Acknowledgements ###

- Ongaro / Ousterhout

### 9 References ###

- Ongaro papers/dissertation
- Raft Reloaded paper
- Lamport paper(s)
