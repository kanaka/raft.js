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
- **security (privacy)**: application state and user messages may need to
  traverse directly from browser to browser rather than traversing
  through a server.
- **locality**: the nature of the application may allow clusters of
  applications that are nearby on a network (e.g. intranet) to
  communicate and coordinate directly rather than passing all messages
  and state through a server back-end which may be considerable more
  remote.
- **bandwidth and scale**: a distributed browser based application may be
  able to avoid expensive bandwidth into and out of the backend
  data-center by passing messages and state directly between browsers.
  Depending on the design of the appication this may also enable
  better scalability then a more centralized model.

Here are some specific use cases in which Raft over WebRTC may be
applicable:
- **Consistent order secure chat**: a chat room system where all users see
  the same message order but messages never traverse through a central
  server even though the application code itself is delivered from
  a central web service.
- **Private multi-user document editing/whiteboard system**: Google
  Docs among other systems has demonstrated a powerful model for
  collaborative document creation. However, these systems all user
  central web services to coordinate shared state and handle
  brower-to-browser communication. Using a Raft over WebRTC could
  enable tools with similar functionality but without the central
  coordnation and communication.
- **Browser based network games**: most network games have certain states
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

#### 3.2.2 Differences between Raft and Raft.js

The current Raft.js implemenation is based on "Consensus", Ongaro and
implements most of the Raft algorithm including: leader election, log
replication, safety, membership changes, client interaction, and
read-only operation optimizations. Log compaction and full client
linearizability are not currently implemented (clients and client
transactions are not assigned unique IDs). These author intends to
implement these functions in the future, however these do not have
a significant impact on the ability to test Raft combined with WebRTC.

The Raft protocol description in "Consensus", Ongaro, has undergone
some revisions since the original draft paper (including incorporation
of suggestions by the author of this paper). These changes include
cluster membership simplifications, separating the concepts of
committing entries to the log and applying entries to the state
machine, etc. As part of the work for implementing Raft
over WebRTC, the Raft.js implementation was updated to reflect the
most recent Raft paper.

The are also some other differences between Raft.js and the Ongaro
paper:

* The paper describes the Raft RPCs in terms of the traditional
  request/response model where requests and reponses are automatically
  correlated together by a lower level of the software stack. For
  example with HTTP 1.0 a separate network session is established for
  each request/response pair (HTTP 1.0). Other examples including
  using a unique per session ID to correlate request and response.
  WebRTC DataChannel connections are message based rather than
  request/response based. The original Raft definition of RPC and RPC
  response messages almost contain enough information to function
  correctly in an environment without builtin request/response
  correlation. Raft.js includes a small modification to the response
  RPCs for requestVote and appendEntries to add a 'sourceId' field.
* The Raft paper is clear that each membership change must be delayed
  until all the previous membership change is committed (sequential).
  It is implied that the leader node should track all pending
  membership change requests and apply them one at a time. However, in
  Raft.js, if a client requests a membership change while another
  change request is pending (uncommitted), the leader will reject the
  change request with a status of 'PENDING_CONFIG_CHANGE'. This
  keeps the core Raft implementation simpler with the trade-off being
  that the client implementation of membership change requests is
  slightly more complex.


### 3.3 WebRTC ###

WebRTC is name of a collection of browser APIs and network protocols
that are currently being standardized the W3C and IETF respectively.
Collectively, these APIs and protocols work together to enable
real-time peer-to-peer video, audio and data communication between
browsers.

#### 3.3.1 WebRTC Discovery and Signaling ####

One of the challenges with browser-to-browser communication (and
direct peer-to-peer communication in general) is that the web browser
environment or user agent (UA) is usually running behind a firewall in
a private internet subnet. This complicates direct communication in
several ways: the public Internet address of the user agent is unknown
and dynamic, inbound connections are denied by default, and outbound
connections are network address translated (NATed).

To establish a direct communication channel between browers, WebRTC
uses mechanism that is similar to the Session Initiation Protocol
(SIP) commonly used for Voice-over-IP (VoIP) communication. This
involves a third party server known as a signaling server. Each user
agent (browser) connects to this server at a well known address in
order to establish a direct connection to other user agents. The
signaling server is also uses to communicate session control messages
(open, close, error) and to negotiate meda capabilities. The signaling
server may optionally provide other services such as higher level
session management, HTTP serving of the web application, address book
service, client presence/availability, etc.

#### 3.3.2 WebRTC APIs ####

The WebRTC browser APIs enable web applications written in JavaScript
to establish browser-to-browser network connectivity in order to
stream real-time video, audio and data communication. These APIs are
currently in the process of being standardized by the W3C organization
(TODO/CITE: http://www.w3.org/TR/webrtc/)

There are three primary WebRTC API definitions:

- [RTCPeerConnection](http://www.w3.org/TR/webrtc/#rtcpeerconnection-interface):
  The RTCPeerConnection API represents a direct connection between two
  browsers. Each RTCPeerConnection object has an associated
  Interactive Connectivity Establishment (ICE) agent that is used to
  establish nework connectivity through firewalls and NAT services.

- [MediaStream (aka
  getUserMedia)](http://www.w3.org/TR/webrtc/#media-stream-api-extensions-for-network-use):
  The MediaStream API represents a stream of audio or video data.
  MediaStreams can easily be sent and received over
  RTCPeerConnections. The MediaStream API defintion provides
  a mechanism that allows JavaScript to enumerate the native
  MediaStreams that are provided by the browser such as a local web
  camera or a live video stream of the desktop (for desktop sharing).
  Although support for MediaStreams was the original impetus for the
  creation of the WebRTC APIs and protocols, the Raft over WebRTC
  implementation does not make use of the MediaStream API.

- [RTCDataChannel](http://www.w3.org/TR/webrtc/#rtcdatachannel): The
  RTCDataChannel API provides a mechanism for sending and receiving
  generic data. A single RTCPeerConnection can contain multiple
  RTCDataChannels. The RTCDataChannel API is modeled after the
  WebSocket API, however, unlike the WebSocket API which is reliable
  and guaranteed order transport (like TCP), each RTCDataChannel can
  be configured with different reliability and ordering settings. For
  example, by relaxing the reliability and ordering constraints on
  a RTCDataChannel, the average latency and jitter per message can be
  decreased even though some messages may be dropped or arrive out of
  order. The Raft protocol is specifically designed to support dropped
  or out-of-order messages so the transport options available with
  RTCDataChannel can be used to gain extra efficiency.


#### 3.3.3 WebRTC Protocol ####

*TODO*

WebRTC defines protocols for the peer-to-peer communication in WebRTC,
however, the signaling transport is not defined as part of WebRTC.
This is up to the application designer.

The signaling server is able to determine the public Internet address
and port of each browser user agent. Actual signaling protocol often
uses WebSockets for transport.

- Protocol soup:
    - Interactive Connectivity Establishment (ICE) framework
        - STUN
        - TURN
    - JSEP
        - SDP
            - the message format exchanged via the signaling server
    - ORTC
    - DLTS


### 3.4 PeerJS ###

PeerJS is a project that provides a simplified abstration for using
WebRTC. The first component of PeerJS is a node.js server library that
implements a WebRTC signaling server. The second component is
a JavaScript library that interacts with that signaling server and
also provides a simpler interface for using the WebRTC APIs.

The JavaScript interface use for establishing the initial connection
(signaling) in the WebRTC 1.0 standard is somewhat complicated.
A competeing standard called Obejct Real-time Communication (ORTC) is
working to define a simpler and more modular JavaScript API for WebRTC
signaling. However, at the time of this work, the ORTC interface was
not yet widely supported and still in a state of flux.  The use of
PeerJS provides a suitable abstraction in the meantime (and will
likely be modified to support ORTC).

#### 3.4.1 PeerJS Server ####

The PeerJS project provides a simple WebRTC signaling server called
PeerServer. This server uses HTTP and WebSockets transport protocols
to perform WebRTC signaling on behalf of browser clients. The
PeerServer server is also extensible so that more advanced services
can be built with it.

- ExpressPeerServer: Express node.js web application framework
  combined with PeerJS signaling server.

*TODO*

#### 3.4.2 PeerJS Client Library ####

*TODO*

### 4 Design and Implementation ###

![Raft over RTC Architecture](raft_rtc_architecture.png "Figure 1: Raft over RTC Architecture")

**Figure 1: Raft over RTC Architecture**

#### 4.1 Incremental Steps ####

During the planning phase, the project was broken down into six
incremental steps:

1. Simple WebRTC messaging: implement a small JavaScript application
   that uses the PeerJS client library and an unmodified PeerJS
   signalling server. Demonstrate communication over WebRTC
   DataChannel using two browser instances (or browser tabs).

2. Raft.js over WebRTC: combine the existing Raft.js implementation
   with the small JavaScript application above to demonstrate Raft
   over WebRTC. This step uses a statically configured three node
   cluster (three browser tabs). The PeerJS signalling server is
   polled to retrieve the list and other clients and the Raft cluster
   is started when the number of PeerJS clients reaches three.

3. Updated Raft.js: update the Raft.js implementation to match the
   latest description of the Raft protocol (as described in
   "Consensus", Ongaro dissertation). This includes the implementation
   of the simplified membership change algorithm (sequential changes)
   and the separation of the log commit and state machine apply
   concepts. [Additionally, the new Raft.js implementation always
   starts a new Raft cluster as a cluster with a single node and
   additional nodes are dynamically added to the cluster (as suggested
   in section 4.4 of the paper).]

4. Dynamic Raft.js over WebRTC: enhance the signaling server with
   support for sessions/channels to enable multiple separate Raft
   clusters. Start each cluster with a single node and automatically
   add and remove Raft nodes as they come and go.

5. Visual representation: display Raft node state and RPC statistics
   in addition to the internal Raft log messages.

6. Server as Raft.js peer (aspirational): enable server nodes (Raft.js
   running on Node.js) to fully participate as Raft cluster nodes.

Steps 1-5 were successfully implemented for this paper. Step 6 was an
aspirational goal because this functionality is not yet supported in
PeerJS although it is being tracked by issue report:
https://github.com/peers/peerjs/issues/103

#### 4.2 Server ####

The file `rtc_server.js` implements the signaling server for the Raft
over WebRTC application. The server extends the PeerJS
`ExpressPeerServer` object in order to provide WebRTC signaling. In
addition to the signaling function, the server also provides the
following services:

* Static web service:

* Peer list endpoint:

* New channel endpoint: new Raft cluster

*TODO*

- bootstrapping: well known address to create a new cluster/channel
    - new channel
    - first server

#### 4.3 Client ####

*TODO*

- addRemoveServersAsync
  - should removes or adds be prioritized?

- provide link for adding new node to a cluster, basically the server
  channel (can be sent to a remote party)

   the first Raft node connects
    * namespace different clusters
      * provide landing location
    * clients need to communicate and detect add/removes
    * automatically add new clients
    * timeout and remove unresponsive clients

### 5 Results ###

*TODO*

- adding and removing
- setTimer/requestAnimantionFrame slower in background frames

### 6 Next Steps ###

*TODO*

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
- Dynamically adjust timeout values to account for changing network
  conditions: original members of cluster may have very different
  network conditions from current members.

### 7 Conclusions ###

*TODO*

- open source

### 8 Acknowledgements ###

*TODO*

- David Levine - supervisor
- Ongaro / Ousterhout

### 9 References ###

*TODO*

- Ongaro papers/dissertation
    https://github.com/ongardie/dissertation/blob/master/online.pdf?raw=true
- Raft Refloated paper
     http://www.cl.cam.ac.uk/~ms705/pub/papers/2015-osr-raft.pdf
- Lamport paper(s)
- IETF WebRTC
    https://tools.ietf.org/html/draft-ietf-rtcweb-overview-13
- PeerJS client in Node.js:
    https://github.com/peers/peerjs/issues/103
- PeerJS server:
    https://github.com/peers/peerjs-server
- WebRTC basics:
    http://www.html5rocks.com/en/tutorials/webrtc/basics/
- WebRTC infrastructure:
    http://www.html5rocks.com/en/tutorials/webrtc/infrastructure/
