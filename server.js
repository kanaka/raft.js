"use strict";

if (typeof Object.create !== 'function') {
    Object.create = function(o) {
        var F = function() {};
        F.prototype = o;
        return new F();
    };
}


function RaftServerBase(id, sendRPC, all_servers, opts) {
    var self = this;

    // 
    // Default Options
    //
    if (typeof opts === 'undefined') {
        opts = {};
    }
    if (typeof opts.electionTimeout === 'undefined') {
        opts.electionTimeout = 300;
    }
    if (typeof opts.heartbeatTime === 'undefined') {
        opts.heartbeatTime = opts.electionTimeout/5;
    }

    //
    // Raft State
    //

    // all servers
    self.state = 'follower'; // follower, candidate, leader
    self.stateMachine = {};
    self.servers = all_servers; // all server IDs including ours
    self.commitIndex;
    // persistant/durable
    self.currentTerm = 0;
    self.votedFor = null;
    self.log = [{term:0, command:'noop'}];  // [{term:TERM, comand:COMMAND}...]

    // candidate servers only
    var votesResponded = {}; // servers that sent RequestVote in this term
    var votesGranted = {}; // servers that gave us a vote in this term
    // leader servers only
    var nextIndex = {};   // last log index for each server
    var lastAgreeIndex;



    // Other state
    var election_timer = null,
        heartbeat_timer = null;

    // Utility functions
    var info = self.info = function() {
        var now = (new Date()).getTime();
        console.log(now + ": " + id + " [" + self.currentTerm + "]: ",
                Array.prototype.slice.call(arguments));
    }
    var dbg = self.dbg = function () {
        if (opts.verbose) {
            self.info.apply(arguments);
        }
    }
    function reset_election_timer() {
        // random between electionTimeout -> electionTimeout*2
        var randTimeout = opts.electionTimeout +
                          parseInt(Math.random()*opts.electionTimeout);
        if (election_timer) {
            election_timer = clearTimeout(election_timer);
        }
        election_timer = setTimeout(start_election, randTimeout);
    }
    function update_term(new_term) {
        if (typeof new_term === 'undefined') {
            new_term = self.currentTerm + 1;
        }
        self.currentTerm = new_term;
        votesResponded = {};
        votesGranted = {};
    }
    function step_down() {
        if (self.state === 'follower') { return; }
        self.state = 'follower';
        info("follower");
        if (heartbeat_timer) {
            heartbeat_timer = clearTimeout(heartbeat_timer);
        }
        if (!election_timer) {
            reset_election_timer();
        }
    }
    function become_leader() {
        if (self.state === 'leader') { return; }
        self.state = 'leader';
        info("leader");
        // send heartbeats until we step down
        function heartbeat_function() {
            if (self.state !== 'leader') { return; }
            for (var i=0; i < self.servers.length; i++) {
                var sid = self.servers[i];
                if (sid === id) {
                    continue;
                }
                sendRPC(sid, 'AppendEntries', {term: self.currentTerm,
                                               leaderId: id, 
                                               prevLogIndex: self.log.length-1,
                                               prevLogTerm: self.log[self.log.length-1].term,
                                               entries: [], // heartbeat
                                               commitIndex: 0}, // TODO

                    function(sid, args) {
                        if (args.term > self.currentTerm) {
                            step_down();
                        }
                    }
                );
            }
            heartbeat_timer = setTimeout(heartbeat_function,
                                         opts.heartbeatTime);
        }
        heartbeat_function();
        election_timer = clearTimeout(election_timer);
        self.votedFor = null;
        votesResponded = {};
        votesGranted = {};
        // TODO: what else?
    }

    // Section 5.2 Leader Election
    function start_election() {
        if (self.state === 'leader') { return; }
        self.state = 'candidate';
        update_term();
        info("candidate");
        // vote for self
        self.votedFor = id;
        votesGranted[id] = true;
        // reset election timeout
        reset_election_timer();
        for (var i=0; i < self.servers.length; i++) {
            var sid = self.servers[i];
            if (sid === id) {
                continue;
            }
            // TODO: reissue 'RequestVote' to non-responders while candidate
            sendRPC(sid, 'RequestVote', {term: self.currentTerm,
                                         candidateId: id, 
                                         lastLogIndex: self.log.length-1,
                                         lastLogTerm: self.log[self.log.length-1].term},
                function (other_id, args) {
                    if ((self.state !== 'candidate') ||
                        (args.term < self.currentTerm)) {
                        // ignore
                        return;
                    }
                    if (args.term > self.currentTerm) {
                        // Does this happen? How?
                        step_down();
                        return;
                    }
                    if (args.voteGranted) {
                        dbg("got vote from:", sid);
                        votesGranted[sid] = true;
                    }
                    dbg("votesGranted: ", votesGranted);
                    // Check if we won the election
                    var need = Math.round((self.servers.length+1)/2); // more than half
                    if (Object.keys(votesGranted).length >= need) {
                        become_leader();
                    }
                }
            );
        }
    }

    //
    // RPCs/Public API (Figure 2)
    //

    // RequestVote RPC
    //   args keys: term, candidateId, lastLogIndex, lastLogTerm
    function RequestVote(args) {
        // 1.
        if (args.term < self.currentTerm) {
            return {term:self.currentTerm, voteGranted:false};
        }
        // 2.
        if (args.term > self.currentTerm) {
            update_term(args.term);
            step_down(); // step down from candidate or leader
        }
        // 3.
        if ((self.votedFor === null || self.votedFor === args.candidateId) &&
                (args.lastLogTerm >= self.log[self.log.length-1].term || 
                 (args.lastLogTerm === self.log[self.log.length-1].term &&
                  args.lastLogIndex >= self.log.length-1))) {
            // we have not voted for somebody else and the candidate
            // log at least as current as ours
            self.votedFor = args.candidateId;
            reset_election_timer();
            return {term:self.currentTerm, voteGranted:true};
        }

        return {term:self.currentTerm, voteGranted:false};
    }

    // AppendEntries RPC
    //   args keys: term, leaderId, prevLogIndex, prevLogTerm,
    //              entries, commitIndex
    function AppendEntries(args) {
        // 1.
        if (args.term < self.currentTerm) {
            // continue in same state
            return [self.currentTerm, false];
        }
        // 2.
        if (args.term > self.currentTerm) {
            update_term(args.term);
        }
        // 3.
        step_down(); // step down from candidate or leader
        // 4.
        reset_election_timer();
        // 5. return fail if log doesn't contain an entry at
        //    prevLogIndex whose term matches prevLogTerm
        if (self.log[args.prevLogIndex].term !== args.prevLogTerm) {
            return [self.currentTerm, false];
        }
        // 6. TODO: If existing entries conflict with new entries,
        // delete all existing entries starting with first conflicting
        // entry
        // 7. TODO: append any new entries not already in the log
        // 8. TODO: apply newly committed entries to the state machine

        // no log entries is a heartbeat, reset election timer
        if (args.entries.length === 0) {
            reset_election_timer();
        }
        return [self.currentTerm, true];
    }


    // start election timeout timer
    reset_election_timer();
    // TODO: load persistent/durable state from disk
    update_term();
    // start as follower by default
    step_down();


    // Public API/RPCs
    var api = {RequestVote:RequestVote,
               AppendEntries:AppendEntries};
    if (opts.debug) {
        api._self = self;
        api._step_down = step_down;
        api._start_election = start_election;
    }

    return api;
}

// RaftServer that uses in-process communication for RPC
// Most useful for testing
var localRaftServerPool = {};
function RaftServerLocal(id, all_servers, opts) {
    "use strict";
    var self = this;
    if (id in localRaftServerPool) {
        throw new Error("Server id '" + id + "' already exists");
    }
    
    function localRPC (targetId, rpcName, args, callback) {
        self.dbg("RPC to "  + targetId + ": " + rpcName + " (" + args + ")");
        if (!targetId in localRaftServerPool) {
            console.log("Server id '" + targetId + "' does not exist");
            // No target, just drop RPC (no callback)
            return;
        }
        var results = localRaftServerPool[targetId][rpcName](args);
        callback(targetId, results);
    }


    var parent = RaftServerBase.call(self, id, localRPC, all_servers, opts);
    localRaftServerPool[id] = parent;
    //console.log("localRaftServerPool: ", localRaftServerPool);
    return parent;
}
 

exports.RaftServerBase = RaftServerBase;
exports.RaftServerLocal = RaftServerLocal;
exports.localRaftServerPool = localRaftServerPool;
