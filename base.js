/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2013 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for description and usage instructions.
 */

"use strict";

function copyOpts(obj) {
    var nobj = {};
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) nobj[k] = obj[k];
    }
    return nobj;
};

function RaftServerBase(id, opts) {
    var self = this,
        api = {};
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
    setDefault('serverMap',         {id: true});
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

    // all servers, ephemeral
    self.state = 'follower'; // follower, candidate, leader
    self.stateMachine = opts.stateMachineStart;
    self.servers = Object.keys(opts.serverMap); // all server IDs including ours
    self.commitIndex = 0; // highest index known to be committed
    // all servers, persistant/durable
    self.currentTerm = -1;
    self.votedFor = null;
    self.log = [{term:0, command:null}];  // [{term:TERM, comand:COMMAND}...]

    // candidate servers only, ephemeral
    var votesResponded = {}; // servers that sent requestVote in this term
    var votesGranted = {}; // servers that gave us a vote in this term
    // leader servers only, ephemeral
    var nextIndex = {};   // index of next log entry to send to follower
    var lastAgreeIndex = {}; // latest index of agreement with server


    // Other server state, ephemeral
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

    //
    // Internal implementation functions
    //

    // Reset the election timer to a random between value between
    // electionTimeout -> electionTimeout*2
    function reset_election_timer() {
        var randTimeout = opts.electionTimeout +
                          parseInt(Math.random()*opts.electionTimeout);
        if (election_timer) {
            election_timer = clearTimeout(election_timer);
        }
        election_timer = setTimeout(start_election, randTimeout);
    }

    // Set our term to new_term (defaults to currentTerm+1)
    function update_term(new_term) {
        if (typeof new_term === 'undefined') {
            new_term = self.currentTerm + 1;
        }
        self.currentTerm = new_term;
        pendingPersist = true;
        votesResponded = {};
        votesGranted = {};
    }

    // Become a follower and start the election timeout timer
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

    // Send an RPC to each of the other servers
    function sendRPCs(rpc, args, callback) {
        for (var i=0; i < self.servers.length; i++) {
            var sid = self.servers[i];
            if (sid === id) {
                continue;
            }
            opts.sendRPC(sid, rpc, args, callback);
        }
    }

    // If pendingPersist is set then this means some aspect of our
    // durable state has changed so call opts.saveFn to save it to
    // durable storage. Finally call callback.
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

    // Call opts.loadFn to load our durable state from durable
    // storage. If loadFn fails then initialize to starting state.
    // Also initialize voting related state, then call callback.
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

    function commitEntries(lastIdx) {
        var firstIdx = self.commitIndex;
        for (var idx=firstIdx; idx <= lastIdx; idx++) {
            var entry = self.log[idx],
                cmd = entry.command;
            if (cmd) {
                self.dbg("Applying:", cmd);
                // TODO: handle exceptions
                var result = opts.applyCmd(self.stateMachine, cmd);
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
            self.commitIndex = idx;
        }
    }

    // Return the log index that is stored on a majority of the
    // servers in serverIds
    function getMajorityIndex(serverIds) {
        // gather a list of current agreed on log indexes
        var agreeIndexes = [self.log.length-1];
        for (var i=0; i < serverIds.length; i++) {
            var sidi = serverIds[i];
            if (sidi === id) { continue; }
            agreeIndexes.push(lastAgreeIndex[sidi]);
        }
        // Sort the agree indexes and and find the index
        // at (or if odd, just above) the half-way mark.
        // This index is the one that is stored on
        // a majority of the given serverIds.
        agreeIndexes.sort();
        var agreePos = Math.floor(serverIds.length/2),
            majorityIndex = agreeIndexes[agreePos];
        return majorityIndex;
    }

    // The core of the leader/log replication algorithm, called
    // periodically (opts.heartbeatTime) while a leader.
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
                    // A log entry is considered committed if
                    // it is stored on a majority of the servers;
                    // also, at least one entry from the leader's
                    // current term must also be stored on a majority
                    // of the servers.
                    lastAgreeIndex[sid] = curAgreeIndex;
                    nextIndex[sid] = curAgreeIndex+1;
                    var majorityIndex = getMajorityIndex(self.servers);
                    // Is our term stored on a majority of the servers
                    if (majorityIndex > self.commitIndex) {
                        var termStored = false;
                        for (var idx=majorityIndex; idx < self.log.length; idx++) {
                            if (self.log[idx].term === self.currentTerm) {
                                termStored = true;
                                break;
                            }
                        }
                        if (termStored) {
                            commitEntries(majorityIndex);
                        }
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

    // We won the election so initialize the leader state, record our
    // win in the log (addition to Raft algorithm), and call the
    // leader_heartbeat function.
    function become_leader() {
        if (self.state === 'leader') { return; }
        info("leader");
        self.state = 'leader';
        leaderId = id;
        votesResponded = {};
        votesGranted = {};
        self.votedFor = null;
        pendingPersist = true;

        // NOTE: this is an addition to the basic Raft algorithm:
        // add leader entry to log to force all previous entries to
        // become committed; at least one entry from leader's current
        // term must be added to the log before prior entries are
        // considered committed. Otherwise, read-only commands after
        // an election would return stale data until somebody does
        // an update command.
        self.log[self.log.length] = {term:self.currentTerm,
                                     command:null,
                                     newLeaderId: id};

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

        var requestVoteResponse = function(other_id, args) {
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
        // TODO: reissue 'requestVote' quickly to non-responders while candidate
        sendRPCs('requestVote',
                {term: self.currentTerm,
                 candidateId: id, 
                 lastLogIndex: self.log.length-1,
                 lastLogTerm: self.log[self.log.length-1].term},
            requestVoteResponse);
    }

    // We are terminating either as a result of being removed by
    // a membership change or by direct invocation (for
    // testing/debug).
    function terminate() {
        // Disable any timers
        heartbeat_timer = clearTimeout(heartbeat_timer);
        election_timer = clearTimeout(election_timer);
        // Ignore or reject RPC/API calls
        api.requestVote = function(args) {
            self.dbg("Ignoring clientRequest(", args, ")");
        };
        api.appendEntries = function(args) {
            self.dbg("Ignoring appenEntries(", args, ")");
        };
        api.clientRequest = function(cmd, callback) {
            self.dbg("Rejecting clientRequest(", cmd, ")");
            callback({'status': 'error', 'msg': 'terminated'});
        };
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

        // TODO: if pending clientCallbacks this means we were
        // a leader and lost it, reject the clientCallbacks with
        // not_leader

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
            console.log("here1",args.prevLogIndex, args.entries, self.log.length);
            pendingPersist = true;
        }
        // 8. apply newly committed entries to the state machine
        if (self.commitIndex < args.commitIndex) {
            commitEntries(args.commitIndex);
        }

        saveBefore(function() {
            callback({term:self.currentTerm, success:true});
        });
    }

    // clientRequest
    //   - cmd is map that is opaque for the most part but may contain
    //     a "ro" key (read-only) that when truthy implies the cmd is
    //     a read operation that will not change the stateMachine and
    //     is called with the stateMachine immediately.
    //   - callback is called after the cmd is committed (or
    //     immediately for a read-only cmd) and applied to the
    //     stateMachine
    function clientRequest(cmd, callback) {
        if (self.state !== 'leader') {
            // tell the client to use a different server
            callback({'status': 'not_leader', 'leaderId': leaderId});
            return;
        }
        // NOTE: this is an addition to the basic Raft algorithm:
        // Read-only operations are applied immediately against the
        // current state of the stateMachine (i.e. committed state)
        // and are not added to the log. Otherwise, the cmd is added
        // to the log and the client callback will be called when the
        // cmdn is is committed. See 7.1
        if (cmd.ro) {
            var result = opts.applyCmd(self.stateMachine, cmd);
            callback({status: 'success',
                      result: result});
        } else {
            clientCallbacks[self.log.length] = callback;
            self.log[self.log.length] = {term:self.currentTerm,
                                         command:cmd};
            pendingPersist = true;
            leader_heartbeat();
        }
    }

    // Initialization/constructor: load any durable state from
    // storage, become a follower and start the election timeout
    // timer.
    loadBefore(function() {
        // start as follower by default
        step_down();
        reset_election_timer();
    });


    // Public API/RPCs
    api = {requestVote:   requestVote,
           appendEntries: appendEntries,
           clientRequest: clientRequest};
    if (opts.debug) {
        api._self = self;
        api._step_down = step_down;
        api._start_election = start_election;
        api._terminate = terminate;
    }

    return api;
}

exports.copyOpts = copyOpts;
exports.RaftServerBase = RaftServerBase;
