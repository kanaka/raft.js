"use strict";

function RaftServerBase(id, opts) {
    var self = this;
    self.id = id;
    opts = opts || {};

    if (typeof id === 'undefined' || !opts.sendRPC || !opts.applyCmd) {
        throw new Error("id, opts.sendRPC and opts.applyCmd required");
    }

    // 
    // Default Options
    //
    function setDefault(k, v) {
        if (typeof opts[k] === 'undefined') { opts[k] = v; }
    }
    setDefault('electionTimeout',   300);
    setDefault('heartbeatTime',     opts.electionTimeout/5);
    setDefault('stateMachineStart', {});
    setDefault('serverStart',       [id]);
    if (typeof opts.saveFn === 'undefined') {
        console.warn("no saveFn, server recovery will not work");
        opts.saveFn = function(data, callback) {
            // no-op
            if(callback) { callback(); }
        }
    }
    if (typeof opts.loadFn === 'undefined') {
        console.warn("no loadFn, server recovery will not work");
        opts.loadFn = function(callback) {
            if(callback) { callback(false); }
        }
    }

    //
    // Raft State
    //

    // all servers
    self.state = 'follower'; // follower, candidate, leader
    self.stateMachine = opts.stateMachineStart;
    self.servers = opts.serverStart; // all server IDs including ours
    self.commitIndex = 0; // highest index known to be committed
    // persistant/durable
    self.currentTerm = -1;
    self.votedFor = null;
    self.log = [{term:0, command:null}];  // [{term:TERM, comand:COMMAND}...]

    // candidate servers only
    var votesResponded = {}; // servers that sent requestVote in this term
    var votesGranted = {}; // servers that gave us a vote in this term
    // leader servers only
    var nextIndex = {};   // index of next log entry to send to follower
    var lastAgreeIndex = {}; // latest index of agreement with server


    // Other state
    var election_timer = null,
        heartbeat_timer = null,
        leaderId = null,
        clientCallbacks = {}, // client callbacks keyed by log index
        pendingPersist = false;

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

    // Internal implementation functions
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
        pendingPersist = true;
        votesResponded = {};
        votesGranted = {};
    }

    function step_down() {
        if (self.state === 'follower') { return; }
        info("follower");
        self.state = 'follower';
        if (heartbeat_timer) {
            heartbeat_timer = clearTimeout(heartbeat_timer);
        }
        if (!election_timer) {
            reset_election_timer();
        }
    }

    // send an RPC to each of the other servers
    function sendRPCs(rpc, args, callback) {
        for (var i=0; i < self.servers.length; i++) {
            var sid = self.servers[i];
            if (sid === id) {
                continue;
            }
            opts.sendRPC(sid, rpc, args, callback);
        }
    }

    function saveBefore(callback) {
        if (pendingPersist) {
            var data = {currentTerm: self.currentTerm,
                        votedFor: self.votedFor,
                        log: self.log};
            pendingPersist = false;
            opts.saveFn(data, function(success){
                if (!success) {
                    console.error("Failed to persist state");
                }
                callback()
            });
        } else {
            callback();
        }

    }

    function loadBefore(callback) {
        opts.loadFn(function (success, data) {
            if (success) {
                self.currentTerm = data.currentTerm;
                self.votedFor = data.votedFor;
                self.log = data.log;
            } else {
                // set some defaults if nothing found
                self.currentTerm = 0;
                self.votedFor = null;
                self.log = [{term:0, command:null}];  // [{term:TERM, comand:COMMAND}...]
            }
            votesResponded = {};
            votesGranted = {};
            callback();
        });
    }

    // The core of the leader/log replication algorithm
    function leader_heartbeat() {
        if (self.state !== 'leader') { return; }

        // close over the current last log index
        var appendEntriesResponse = (function() {
            var curAgreeIndex = self.log.length-1;
            return function (sid, args) {
                if (args.term > self.currentTerm) {
                    step_down();
                    return;
                }
                if (args.success) {
                    lastAgreeIndex[sid] = curAgreeIndex;
                    // gather a list of current agreed on log indexes
                    var agreeIndexes = [self.log.length-1];
                    for (var i=0; i < self.servers.length; i++) {
                        var sidi = self.servers[i];
                        if (sidi === id) { continue; }
                        agreeIndexes.push(lastAgreeIndex[sidi]);
                    }
                    // Sort the agree indexes and and find the index
                    // at (or if odd, just above) the half-way mark.
                    // This index is the one that is stored on
                    // a majority of servers.
                    agreeIndexes.sort();
                    var agreePos = Math.floor(self.servers.length/2),
                        majorityIndex = agreeIndexes[agreePos];
                    // If majority of followers have stored entries,
                    // then commit those entries.
                    // TODO: at least one entry from the leader's
                    // current term must also be stored on
                    // a majority of the servers.
                    if (majorityIndex > self.commitIndex) {
                        for (var idx=self.commitIndex+1; idx <= majorityIndex; idx++) {
                            // TODO: handle exceptions
                            var cmd = self.log[idx].command,
                                result = opts.applyCmd(self.stateMachine, cmd);
                            // call client callback for the committed cmds
                            var clientCallback = clientCallbacks[idx];
                            if (clientCallback) {
                                delete clientCallbacks[idx];
                                // TODO: saveBefore wider scope?
                                saveBefore(function() {
                                    clientCallback({'status': 'success',
                                                    'result': result});
                                });
                            }
                        }
                        self.commitIndex = majorityIndex;
                    }
                } else {
                    nextIndex[sid] -= 1;
                    // TODO: resend immediately
                }
            };
        })();

        for (var i=0; i < self.servers.length; i++) {
            var sid = self.servers[i];
            if (sid === id) { continue; }
            var nindex = nextIndex[sid]-1,
                nterm = self.log[nindex].term,
                nentries = self.log.slice(nindex+1);

            opts.sendRPC(sid, 'appendEntries',
                    {term: self.currentTerm,
                     leaderId: id, 
                     prevLogIndex: nindex,
                     prevLogTerm: nterm,
                     entries: nentries,
                     commitIndex: self.commitIndex},
                appendEntriesResponse);
        }
        // we may be called directly so cancel any outstanding timer
        clearTimeout(heartbeat_timer);
        // queue us up to be called again
        heartbeat_timer = setTimeout(leader_heartbeat,
                opts.heartbeatTime);
    }

    function become_leader() {
        if (self.state === 'leader') { return; }
        info("leader");
        self.state = 'leader';
        leaderId = id;
        votesResponded = {};
        votesGranted = {};
        self.votedFor = null;
        pendingPersist = true;

        for (var i=0; i < self.servers.length; i++) {
            // start nextIndex set to the next entry in the log
            nextIndex[self.servers[i]] = self.log.length;
            // Start lastAgreeIndex set to commitIndex
            lastAgreeIndex[self.servers[i]] = self.commitIndex;
        }

        election_timer = clearTimeout(election_timer);
        // start sending heartbeats (appendEntries) until we step down
        saveBefore(leader_heartbeat);
    }

    // Section 5.2 Leader Election
    function start_election() {
        if (self.state === 'leader') { return; }
        info("candidate");
        self.state = 'candidate';
        update_term();
        // vote for self
        self.votedFor = id;
        votesGranted[id] = true;
        pendingPersist = true;
        // reset election timeout
        reset_election_timer();
        // TODO: reissue 'requestVote' quickly to non-responders while candidate
        sendRPCs('requestVote',
                {term: self.currentTerm,
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
                    dbg("got vote from:", other_id);
                    votesGranted[other_id] = true;
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

    //
    // RPCs/Public API (Figure 2)
    //

    // requestVote RPC
    //   args keys: term, candidateId, lastLogIndex, lastLogTerm
    function requestVote(args, callback) {
        // 1. return if term < currentTerm
        if (args.term < self.currentTerm) {
            saveBefore(function() {
                callback({term:self.currentTerm, voteGranted:false});
            });
            return;
        }
        // 2. if term > currentTerm, set currentTerm to term
        if (args.term > self.currentTerm) {
            update_term(args.term);
            step_down(); // step down from candidate or leader
        }
        // 3. if votedFor is null or candidateId, and candidate's log
        // candidate's log is at least as complete as local log, grant
        // vote and reset election timeout
        if ((self.votedFor === null || self.votedFor === args.candidateId) &&
                (args.lastLogTerm >= self.log[self.log.length-1].term || 
                 (args.lastLogTerm === self.log[self.log.length-1].term &&
                  args.lastLogIndex >= self.log.length-1))) {
            // we have not voted for somebody else and the candidate
            // log at least as current as ours
            self.votedFor = args.candidateId;
            pendingPersist = true;
            reset_election_timer();
            saveBefore(function() {
                callback({term:self.currentTerm, voteGranted:true});
            });
            return;
        }

        saveBefore(function() {
            callback({term:self.currentTerm, voteGranted:false});
        });
        return;
    }

    // appendEntries RPC
    //   args keys: term, leaderId, prevLogIndex, prevLogTerm,
    //              entries, commitIndex
    function appendEntries(args, callback) {
        // 1. return if term < currentTerm
        if (args.term < self.currentTerm) {
            // continue in same state
            saveBefore(function() {
                callback({term:self.currentTerm, success:false});
            });
            return;
        }
        // 2. if term > currentTerm, set currentTerm to term
        if (args.term > self.currentTerm) {
            update_term(args.term);
        }
        // 3. if candidate or leader, step down
        step_down(); // step down from candidate or leader
        leaderId = args.leaderId;
        // 4. reset election timeout
        reset_election_timer();

        // 5. return fail if log doesn't contain an entry at
        //    prevLogIndex whose term matches prevLogTerm
        if ((self.log.length - 1 < args.prevLogIndex) ||
            (self.log[args.prevLogIndex].term !== args.prevLogTerm)) {
            saveBefore(function() {
                callback({term:self.currentTerm, success:false});
            });
            return;
        }
        // 6. If existing entries conflict with new entries,
        // delete all existing entries starting with first conflicting
        // entry
        // 7. append any new entries not already in the log
        if ((args.prevLogIndex+1 < self.log.length) ||
            (args.entries.length > 0)) {
            Array.prototype.splice.apply(self.log,
                    [args.prevLogIndex+1, self.log.length].concat(args.entries));
            pendingPersist = true;
        }
        // 8. apply newly committed entries to the state machine
        if (self.commitIndex < args.commitIndex) {
            for (var idx=self.commitIndex+1; idx <= args.commitIndex; idx++) {
                // TODO: handle exceptions
                var cmd = self.log[idx].command;
                opts.applyCmd(self.stateMachine, cmd);
            }
            self.commitIndex = args.commitIndex;
        }

        saveBefore(function() {
            callback({term:self.currentTerm, success:true});
        });
    }

    // clientRequest RPC
    //   cmd is opaque and sent to opts.applyCmd
    //   callback is called after the cmd is committed and applied to
    //   the stateMachine
    function clientRequest(cmd, callback) {
        if (self.state !== 'leader') {
            // tell the client to use a different server
            callback({'status': 'not_leader', 'leaderId': leaderId});
            return;
        }
        clientCallbacks[self.log.length] = callback;
        self.log[self.log.length] = {term:self.currentTerm,
                                     command:cmd};
        pendingPersist = true;
        leader_heartbeat();
    }


    loadBefore(function() {
        // start as follower by default
        step_down();
        reset_election_timer();
    });


    // Public API/RPCs
    var api = {requestVote:   requestVote,
               appendEntries: appendEntries,
               clientRequest: clientRequest};
    if (opts.debug) {
        api._self = self;
        api._step_down = step_down;
        api._start_election = start_election;
    }

    return api;
}

exports.RaftServerBase = RaftServerBase;
