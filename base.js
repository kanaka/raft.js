/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2013 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for description and usage instructions.
 */

"use strict";

if (typeof module === 'undefined') {
    var base = {},
        exports = base;
}

function copyMap(obj) {
    var nobj = {};
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) nobj[k] = obj[k];
    }
    return nobj;
};
function setDefault(o, k, v) {
    if (typeof o[k] === 'undefined') { o[k] = v; }
}

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
    setDefault(opts, 'electionTimeout',   300);
    setDefault(opts, 'heartbeatTime',     opts.electionTimeout/5);
    setDefault(opts, 'stateMachineStart', {});
    setDefault(opts, 'serverMap',         {id: true});
    setDefault(opts, 'schedule',          function(fn, ms) {
                                            return setTimeout(fn, ms); });
    setDefault(opts, 'unschedule',        function(id) {
                                            return clearTimeout(id); });
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
    self.serverMap = opts.serverMap;  // all servers, us included
    self.newServerMap = null;  // set means joint consensus
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
    var matchIndex = {}; // latest index known replicated to follower


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

    // Returns a list of all server IDs, basically intersection of IDs
    // from self.serverMap and self.newServerMap.
    function servers() {
        var sv = copyMap(self.serverMap);
        for (var k in self.newServerMap) {
            sv[k] = self.newServerMap[k];
        }
        return Object.keys(sv);
    }

    // Reset the election timer to a random between value between
    // electionTimeout -> electionTimeout*2
    function reset_election_timer() {
        var randTimeout = opts.electionTimeout +
                          parseInt(Math.random()*opts.electionTimeout);
        if (election_timer) {
            election_timer = opts.unschedule(election_timer);
        }
        election_timer = opts.schedule(start_election, randTimeout);
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
            heartbeat_timer = opts.unschedule(heartbeat_timer);
        }
        if (!election_timer) {
            reset_election_timer();
        }
    }

    // Send an RPC to each of the other servers
    function sendRPCs(rpc, args, callback) {
        var sids = servers(); 
        for (var i=0; i < sids.length; i++) {
            var sid = sids[i];
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
                addEntries(data.log, true);
            } else {
                // set some defaults if nothing found
                self.currentTerm = 0;
                self.votedFor = null;
                addEntries([{term:0, command:null}], true);
            }
            votesResponded = {};
            votesGranted = {};
            // We are starting up/reseting our state, assume that
            // opts.serverMap is our current membership.
            // TODO: is this correct if the log says we were in
            // joint consensus?
            self.serverMap = opts.serverMap;
            self.newServerMap = null;
            callback();
        });
    }

    // Add an array of entries to the log. Each entry is checked for
    // membership change entries (Cold,new or Cnew) and self.serverMap
    // and self.newServerMap are updated to reflect this (membership
    // change entries come into effect as soon as we see them and not
    // when they are committed)
    function addEntries(entries, startup) {
        for (var i=0; i < entries.length; i++) {
            var entry = entries[i],
                cmd = entry.command;
            if (typeof entry.term === 'undefined') {
                entry.term = self.currentTerm;
            }
            if (!cmd) {
                entry.command = null;
            }

            // Check for membership changes. Cold,new and Cnew take effect
            // as soon as we see them, not when they are committed
            if (cmd && !startup) {
                if (cmd.op === 'Cold,new') {
                    // Joint consensus (Cold,new)
                    self.serverMap = cmd.oldServerMap;
                    self.newServerMap = cmd.newServerMap;
                } else if (cmd.op === 'Cnew') {
                    // Transition to Cnew
                    self.serverMap = cmd.newServerMap;
                    self.newServerMap = null;
                }
            }
            self.log[self.log.length] = entry;
        }
    }

    // Commit log entries from self.commitIndex up to lastIdx by
    // calling opts.applyCmd on the current state of
    // self.stateMachine. Also handle log entries that are part of
    // changing membership (joint consensus)
    function commitEntries(lastIdx) {
        var firstIdx = self.commitIndex+1,
            result = null,
            callbacks = {};
        for (var idx=firstIdx; idx <= lastIdx; idx++) {
            var entry = self.log[idx],
                cmd = entry.command;
            self.commitIndex = idx;
            if (!cmd) {
                continue;

            // TODO: should only do this for entries we didn't load
            // from disk
            } else if (cmd.op === 'Cold,new') {
                result = "committed Cold,new";
                if (self.state === 'leader') {
                    // We are committing Cnew,old and adding Cnew.
                    // Cnew takes effect as soon as a server has seen
                    // Cnew and since we are the leader and adding it,
                    // we have implicitly seen it.
                    self.serverMap = cmd.newServerMap;
                    self.newServerMap = null;
                    var cmdNew = {op:           'Cnew',
                                  newServerMap: cmd.newServerMap};
                    addEntries([{command:cmdNew}]);
                    result += ", adding Cnew";
                }
            } else if (cmd.op === 'Cnew') {
                // We are committing Cnew. If we are not part of
                // Cnew then we need step down and terminate
                result = "committed Cnew";
                if (!id in cmd.newServerMap) {
                    step_down();
                    terminate();
                    result += ", removed from membership";
                }
            } else {
                self.dbg("Applying:", cmd);
                // TODO: handle exceptions
                result = opts.applyCmd(self.stateMachine, cmd);
            }
            // call client callback for the committed cmds
            var clientCallback = clientCallbacks[idx];
            if (clientCallback) {
                callbacks[idx] = [clientCallback, result];
                delete clientCallbacks[idx];
            }
        }
        saveBefore(function() {
            for (var idx in callbacks) {
                var callback = callbacks[idx][0],
                    result =   callbacks[idx][1];
                callback({'status': 'success',
                          'result': result});
            }
        });
    }

    // Return the log index that is stored on a majority of the
    // servers in serverIds
    function getMajorityIndex(serverIds) {
        // gather a list of current agreed on log indexes
        var agreeIndexes = [self.log.length-1];
        for (var i=0; i < serverIds.length; i++) {
            var sidi = serverIds[i];
            if (sidi === id) { continue; }
            agreeIndexes.push(matchIndex[sidi]);
        }
        // Sort the agree indexes and and find the index
        // at (or if even, just above) the half-way mark.
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
                    matchIndex[sid] = curAgreeIndex;
                    nextIndex[sid] = curAgreeIndex+1;
                    var sids = Object.keys(self.serverMap),
                        majorityIndex = getMajorityIndex(sids);
                    // If newServerMap is set then we are in joint
                    // consensus and entries must be on the majority
                    // of both the old and new set of servers
                    if (self.newServerMap) {
                        var sids2 = Object.keys(self.newServerMap),
                            newMajorityIndex = getMajorityIndex(sids2);
                        if (newMajorityIndex < majorityIndex) {
                            majorityIndex = newMajorityIndex;
                        }
                    }
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

        var sids = servers();
        for (var i=0; i < sids.length; i++) {
            var sid = sids[i];
            if (sid === id) { continue; }
            var nindex = nextIndex[sid]-1,
                nterm = self.log[nindex].term,
                nentries = self.log.slice(nindex+1);
            if (nentries.length > 0) {
                self.dbg("sid:",sid,"sids:",sids,"nentries:",nentries);
            }

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
        opts.unschedule(heartbeat_timer);
        // queue us up to be called again
        heartbeat_timer = opts.schedule(leader_heartbeat,
                opts.heartbeatTime);
    }


    // Checks a vote map against a server map. Return true if more
    // than half of the servers in server map have votes in the vote
    // map.  During joint consensus we need to check all of Cold,new
    // which means checking Cold (self.serverMap) and Cnew
    // (self.newServerMap) separately. Only if both have a majority is
    // an election successful.
    function check_vote(serverMap, voteMap) {
        var sids = Object.keys(serverMap),
            need = Math.round((sids.length+1)/2), // more than half
            votes = {};
        for (var k in serverMap) {
            if (k in voteMap) {
                votes[k] = true;
            }
        }
        if (Object.keys(votes).length >= need) {
            return true;
        } else {
            return false;
        }
    }

    // Initialize nextIndex and matchIndex for each server. The
    // optional argument indicates that the indexes should be
    // initialized from scratch (rather than just updated for new
    // members) which is done when we are a newly elected leader.
    function update_indexes(from_scratch) {
        if (from_scratch) {
            nextIndex = {};
            matchIndex = {};
        }
        var sids = servers();
        for (var i=0; i < sids.length; i++) {
            // start nextIndex set to the next entry in the log
            if (typeof nextIndex[sids[i]] === 'undefined') {
                nextIndex[sids[i]] = self.log.length;
            }
            // Start matchIndex set to commitIndex
            if (typeof matchIndex[sids[i]] === 'undefined') {
                matchIndex[sids[i]] = self.commitIndex;
            }
        }
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
        addEntries([{newLeaderId:id}]);

        update_indexes(true);

        election_timer = opts.unschedule(election_timer);
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
            if (check_vote(self.serverMap, votesGranted)) {
                // If self.newServerMap is set then we are in joint
                // consensus so we must check votes for that server
                // set too
                if (!self.newServerMap ||
                    check_vote(self.newServerMap, votesGranted)) {
                    become_leader();
                }
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
        self.info("terminating");
        // Disable any timers
        heartbeat_timer = opts.unschedule(heartbeat_timer);
        election_timer = opts.unschedule(election_timer);
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
        if (args.prevLogIndex+1 < self.log.length) {
            self.log.splice(args.prevLogIndex+1, self.log.length);
        }
        // 7. append any new entries not already in the log
        if (args.entries.length > 0) {
            addEntries(args.entries);
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
    //     is called with the stateMachine immediately. It may also
    //     contain a 'newServerMap' key with a map of the target
    //     server configuration (same format as opts.serverMap)
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
        cmd = copyMap(cmd);
        if (cmd.ro) {
            var result = opts.applyCmd(self.stateMachine, cmd);
            callback({status: 'success',
                      result: result});
        } else {
            clientCallbacks[self.log.length] = callback;
            addEntries([{command:cmd}]);
            if (cmd.op === 'Cold,new' || cmd.op === 'Cnew') {
                update_indexes();
            }
            pendingPersist = true;
            // trigger leader heartbeat
            setTimeout(leader_heartbeat,1);
        }
    }

    // changeMembership
    //   - newServerMap is the new map of server IDs to addresses for
    //     the new membership. This is really just a wrapper around
    //     clientRequest that adds a 'Cold,new' command.
    //   - callback is called after joint consensus (Cold,new) is
    //     committed (not when Cnew is committed)
    function changeMembership(newServerMap, callback) {
        // Create Cold,new joint consensus state
        // TODO: check that newServerMap overlaps enough with
        // self.serverMap
        var cmd = {op:          'Cold,new',
                   oldServerMap: self.serverMap,
                   newServerMap: newServerMap};
        clientRequest(cmd, callback);
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
    api = {requestVote:      requestVote,
           appendEntries:    appendEntries,
           clientRequest:    clientRequest,
           changeMembership: changeMembership};
    if (opts.debug) {
        api._self = self;
        api._step_down = step_down;
        api._start_election = start_election;
        api._terminate = terminate;
    }

    return api;
}

exports.copyMap = copyMap;
exports.setDefault = setDefault;
exports.RaftServerBase = RaftServerBase;
