/*
 * raft.js: Raft consensus algorithm in JavaScript
 * Copyright (C) 2015 Joel Martin
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
    var self = this, api = {};
    self.id = id;

    //
    // Raft Algorithm State (explicit in Figure 3.1)
    //

    // Persistent/durable state on all servers (Figure 3.1)
    self.currentTerm = 0;
    self.votedFor = null;
    self.log = [{term:0, command:null}];  // [{term:TERM, comand:COMMAND}...]

    // Volatile/ephemeral state on all servers (Figure 3.1)
    self.commitIndex = 0; // highest index known to be committed
    self.lastApplied = 0; // highext index known to be applied

    // Volatile/ephemeral state on leaders only (Figure 3.1)
    var nextIndex = {};   // index of next log entry to send to follower
    var matchIndex = {}; // latest index known replicated to follower


    //
    // Sanity check options and set defaults
    //
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
    setDefault(opts, 'firstServer',       false);
    setDefault(opts, 'serverData',        {id: true});
    setDefault(opts, 'verbose',           1);
    setDefault(opts, 'log',               function() {
        console.log.apply(console, arguments); });
    setDefault(opts, 'error',             opts.log);
    setDefault(opts, 'schedule',          function(fn, ms, data) {
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

    // all servers, ephemeral
    self.state = 'follower'; // follower, candidate, leader
    self.stateMachine = opts.stateMachineStart;
    self.serverMap = {};  // servers that are part of the cluster

    // candidate servers only, ephemeral
    var votesResponded = {}; // servers that sent requestVote in this term
    var votesGranted = {}; // servers that gave us a vote in this term

    // Other server state, ephemeral
    var election_timer = null,
        heartbeat_timer = null,
        leaderId = null,
        clientCallbacks = {}, // client callbacks keyed by log index
        pendingPersist = false,
        pendingConfigChange = false;

    // Utility functions
    var msg = self.msg = function(args, logger) {
        var now = (new Date()).getTime(),
            prefix = now + ": " + id + " [" + self.currentTerm + "]:";
        logger.apply(null, [prefix].concat(args));
    }
    var dbg = self.dbg = function () {
        if (opts.verbose > 1) {
            self.msg(Array.prototype.slice.call(arguments), opts.log);
        }
    }
    var info = self.info = function () {
        if (opts.verbose > 0) {
            self.msg(Array.prototype.slice.call(arguments), opts.log);
        }
    }
    var error = self.error = function () {
        self.msg(Array.prototype.slice.call(arguments), opts.error);
    }

    //
    // Internal implementation functions
    //

    // Returns a list of all server IDs.
    function servers() {
        return Object.keys(self.serverMap);
    }

    // Clear/cancel any existing election timer
    function clear_election_timer() {
        if (election_timer) {
            election_timer = opts.unschedule(election_timer);
        }
    }
    // Reset the election timer to a random between value between
    // electionTimeout -> electionTimeout*2
    function reset_election_timer() {
        var randTimeout = opts.electionTimeout +
                          parseInt(Math.random()*opts.electionTimeout);
        clear_election_timer();
        election_timer = opts.schedule(start_election, randTimeout);
    }

    // Set our term to new_term (defaults to currentTerm+1)
    function update_term(new_term) {
        if (typeof new_term === 'undefined') {
            new_term = self.currentTerm + 1;
        }
        dbg("set term to: " + new_term);
        self.currentTerm = new_term;
        self.votedFor = null;
        pendingPersist = true;
        votesResponded = {};
        votesGranted = {};
    }

    // Become a follower and start the election timeout timer
    function step_down() {
        if (self.state === 'follower') { return; }
        info("new state 'follower'");
        self.state = 'follower';
        if (heartbeat_timer) {
            heartbeat_timer = opts.unschedule(heartbeat_timer);
        }
        if (!election_timer) {
            reset_election_timer();
        }
    }

    // Send an RPC to each of the other servers
    function sendRPCs(rpc, args) {
        var sids = servers(); 
        for (var i=0; i < sids.length; i++) {
            var sid = sids[i];
            if (sid === id) {
                continue;
            }
            opts.sendRPC(sid, rpc, args);
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
                    error("Failed to persist state");
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
            if (success && opts.firstServer) {
                opts.firstServer = false;
                error("firstServer ignored because loadFn return true");
            }
            if (success) {
                // update state from the loaded data
                dbg("load stored data:", JSON.stringify(data));
                self.currentTerm = data.currentTerm;
                self.votedFor = data.votedFor;
                addEntries(data.log, true);

                info("Loaded durable state, starting election timer");
                // start as follower by default
                step_down();
                reset_election_timer();
            } else if (opts.firstServer) {
                // if no loaded data but we are the first server then
                // start with ourselves as the only member.
                dbg("started as first server");
                self.currentTerm = 0;
                self.votedFor = null;
                // Start with ourselves
                addEntries([{newServer: self.id,
                             oldServers: []}], true);

                info("First server, assuming leadership");
                become_leader();
            } else {
                // if no loaded data and we are not the first server,
                // then we will have an empty log
                self.currentTerm = -1;
                self.votedFor = null;

                info("Not first server, waiting for initial RPC");
                clear_election_timer();
            }
            votesResponded = {};
            votesGranted = {};
            callback();
        });
    }

    // Add an array of entries to the log.
    function addEntries(entries, startup) {
        for (var i=0; i < entries.length; i++) {
            var entry = entries[i];
            if (typeof entry.term === 'undefined') {
                entry.term = self.currentTerm;
            }
            if (typeof entry.command === 'undefined') {
                entry.command = null;
            }

            if ('newServer' in entry) {
                dbg("adding newServer entry:", entry.newServer);
                self.serverMap[entry.newServer] = opts.serverData[entry.newServer];
            } else if (entry.oldServer) {
                dbg("removing oldServer entry:", entry.oldServer);
                delete self.serverMap[entry.oldServer];
            }

            self.log[self.log.length] = entry;
        }
        // TODO: check that all entries in serverMap have connection
        // information in opts.serverData
    }

    // Apply log entries from self.lastApplied up to self.commitIndex
    // by calling opts.applyCmd on the current state of
    // self.stateMachine.
    // Figure 3.1, Rules for Servers, All Servers
    function applyEntries() {
        while (self.commitIndex > self.lastApplied) {
            self.lastApplied += 1;
            var entry = self.log[self.lastApplied],
                cmd = entry.command,
                callbacks = {},
                result = null;
            if (cmd) {
                dbg("applying:", cmd);
                // TODO: handle exceptions
                result = opts.applyCmd(self.stateMachine, cmd);
            }
            // call client callback for the committed cmds
            var clientCallback = clientCallbacks[self.lastApplied];
            if (clientCallback) {
                callbacks[self.lastApplied] = [clientCallback, result];
                delete clientCallbacks[self.lastApplied];
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

        var sids = servers();
        for (var i=0; i < sids.length; i++) {
            var sid = sids[i];
            if (sid === id) { continue; }
            //info("*** sid,nextIndex-1,commitIndex:", sid, nextIndex[sid]-1, self.commitIndex);
            var nindex = nextIndex[sid]-1,
                nterm = self.log[nindex].term,
                nentries = self.log.slice(nindex+1);
            if (nentries.length > 0) {
                dbg("new entries to sid:",sid,"nentries:", JSON.stringify(nentries));
            }

            opts.sendRPC(sid, 'appendEntries',
                    {term: self.currentTerm,
                     leaderId: id, 
                     prevLogIndex: nindex,
                     prevLogTerm: nterm,
                     entries: nentries,
                     leaderCommit: self.commitIndex,
                    
                     curAgreeIndex: self.log.length-1});
        }
        // we may be called directly so cancel any outstanding timer
        opts.unschedule(heartbeat_timer);
        // queue us up to be called again
        heartbeat_timer = opts.schedule(leader_heartbeat,
                                        opts.heartbeatTime);
    }


    // Checks a vote map against a server map. Return true if more
    // than half of the servers in server map have votes in the vote
    // map. Only if we have a majority is an election successful.
    function check_vote(serverMap, voteMap) {
        var scnt = servers().length,
            need = Math.round((scnt+1)/2), // more than half
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
        info("new state 'leader'");
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
        addEntries([{newLeaderId: id}]);

        update_indexes(true);

        clear_election_timer();
        // start sending heartbeats (appendEntries) until we step down
        saveBefore(leader_heartbeat);
    }

    // Section 3.4 Leader Election
    function start_election() {
        if (self.state === 'leader') { return; }
        info("new state 'candidate'");
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
                 lastLogTerm: self.log[self.log.length-1].term});
    }

    // We are terminating either as a result of being removed by
    // a membership change or by direct invocation (for
    // testing/debug).
    function terminate() {
        info("terminating");
        // Disable any timers
        heartbeat_timer = opts.unschedule(heartbeat_timer);
        clear_election_timer();
        // Ignore or reject RPC/API calls
        api.requestVote = function(args) {
            dbg("Ignoring clientRequest(", args, ")");
        };
        api.appendEntries = function(args) {
            dbg("Ignoring appenEntries(", args, ")");
        };
        api.clientRequest = function(cmd, callback) {
            dbg("Rejecting clientRequest(", cmd, ")");
            if (callback) {
                callback({'status': 'error', 'msg': 'terminated'});
            }
        };
    }

    //
    // RPCs/Public API (Figure 2)
    //

    // requestVote RPC
    //   args keys: term, candidateId, lastLogIndex, lastLogTerm
    function requestVote(args) {
        self.dbg("requestVote:", JSON.stringify(args));

        // if term > currentTerm, set currentTerm to term (rules for
        // all servers)
        if (args.term > self.currentTerm) {
            update_term(args.term);
            step_down(); // step down from candidate or leader
        }
        // 1. reply false if term < currentTerm (3.3)
        if (args.term < self.currentTerm) {
            saveBefore(function() {
                opts.sendRPC(args.candidateId, "requestVoteResponse",
                    {term: self.currentTerm,
                     voteGranted: false,
                     // addition
                     sourceId: id});
            });
            return;
        }
        // 2. if votedFor is null or candidateId, and candidate's log
        //    is at least as up-to-date as receiver's log, grant vote
        //    (3.4, 3.6)
        //    - Also reset election timeout (TODO, is reset still
        //      correct?)
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
                opts.sendRPC(args.candidateId, "requestVoteResponse",
                    {term: self.currentTerm,
                     voteGranted: true,
                     // addition
                     sourceId: id});
            });
            return;
        }

        saveBefore(function() {
            opts.sendRPC(args.candidateId, "requestVoteResponse",
                {term: self.currentTerm,
                 voteGranted: false,
                 // addition
                 sourceId: id});
        });
        return;
    }

    function requestVoteResponse(args) {
        self.dbg("requestVoteResponse:", JSON.stringify(args));

        // if term > currentTerm, set currentTerm to term (rules for
        // all servers)
        if (args.term > self.currentTerm) {
            // Does this happen? How?
            update_term(args.term);
            step_down(); // step down from candidate or leader
            return;
        }

        var other_id = args.sourceId;
        if ((self.state !== 'candidate') ||
            (args.term < self.currentTerm)) {
            // ignore
            return;
        }
        if (args.voteGranted) {
            dbg("got vote from:", other_id);
            votesGranted[other_id] = true;
        }
        dbg("current votes:", Object.keys(votesGranted));
        // Check if we won the election
        if (check_vote(self.serverMap, votesGranted)) {
            become_leader();
        }
    }

    // appendEntries RPC (Figure 3.2)
    //   args keys: term, leaderId, prevLogIndex, prevLogTerm,
    //              entries, commitIndex
    function appendEntries(args) {
        self.dbg("appendEntries:", JSON.stringify(args));

        // if term > currentTerm, set currentTerm to term (rules for
        // all servers)
        if (args.term > self.currentTerm) {
            update_term(args.term);
            step_down(); // step down from candidate or leader
        }

        // 1. reply false if term < currentTerm
        if (args.term < self.currentTerm) {
            // continue in same state
            saveBefore(function() {
                opts.sendRPC(args.leaderId, "appendEntriesResponse",
                    {term: self.currentTerm,
                     success: false,
                     // These are additions
                     sourceId: id,
                     curAgreeIndex: args.curAgreeIndex});
            });
            return;
        }
        // if candidate or leader, step down
        step_down(); // step down from candidate or leader
        if (leaderId !== args.leaderId) {
            leaderId = args.leaderId;
            self.info("new leader: " + leaderId);
        }

        // reset election timeout
        reset_election_timer();

        // TODO: if pending clientCallbacks this means we were
        // a leader and lost it, reject the clientCallbacks with
        // not_leader

        // 2. reply false if log doesn't contain an entry at
        //    prevLogIndex whose term matches prevLogTerm
        if ((self.log.length - 1 < args.prevLogIndex) ||
            (self.log[args.prevLogIndex].term !== args.prevLogTerm)) {
            saveBefore(function() {
                opts.sendRPC(args.leaderId, "appendEntriesResponse",
                    {term: self.currentTerm,
                     success: false,
                     // These are additions
                     sourceId: id,
                     curAgreeIndex: args.curAgreeIndex});
            });
            return;
        }
        // 3. If existing entry conflicts with new entry (same index
        //    but different terms), delete the existing entry
        //    and all that follow. TODO: make this match the
        //    description.
        if (args.prevLogIndex+1 < self.log.length) {
            self.log.splice(args.prevLogIndex+1, self.log.length);
        }
        // 4. append any new entries not already in the log
        if (args.entries.length > 0) {
            addEntries(args.entries);
            pendingPersist = true;
        }

        // 5. if leaderCommit > commitIndex, set
        //    commitIndex = min(leaderCommit, index of last new entry)
        if (args.leaderCommit > self.commitIndex) {
            self.commitIndex = Math.min(args.leaderCommit,
                                        self.log.length-1);
            applyEntries();
        }

        saveBefore(function() {
            opts.sendRPC(args.leaderId, "appendEntriesResponse",
                {term: self.currentTerm,
                 success: true,
                 // These are additions
                 sourceId: id,
                 curAgreeIndex: args.curAgreeIndex});
        });
    }

    function appendEntriesResponse(args) {
        self.dbg("appendEntriesResponse:", JSON.stringify(args));
        // if term > currentTerm, set currentTerm to term (rules for
        // all servers)
        if (args.term > self.currentTerm) {
            // Does this happen? How?
            update_term(args.term);
            step_down(); // step down from candidate or leader
            return;
        }

        var sid = args.sourceId;
        if (args.success) {
            // A log entry is considered committed if
            // it is stored on a majority of the servers;
            // also, at least one entry from the leader's
            // current term must also be stored on a majority
            // of the servers.
            matchIndex[sid] = args.curAgreeIndex;
            nextIndex[sid] = args.curAgreeIndex+1;
            var sids = servers(),
                majorityIndex = getMajorityIndex(sids);
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
                    self.commitIndex = Math.min(majorityIndex,
                                                self.log.length-1);
                    applyEntries(majorityIndex);
                }
            }
        } else {
            nextIndex[sid] -= 1;
            // TODO: resend immediately
        }
    }

    // addServer (Figure 4.1)
    //   args keys: newServer (id)
    //   response: status, leaderHint
    function addServer(args, callback) {
        self.dbg("addServer:", JSON.stringify(args));
        // 1. Reply NOT_LEADER if not leader (6.2)
        if (self.state !== 'leader') {
            callback({status: 'NOT_LEADER',
                      leaderHint: leaderId});
            return;
        }

        // NOTE: this is an addition to the Raft algorithm:
        // Instead of doing steps 2 and 3, just reject config
        // changes while an existing one is pending.

        // 2. Catch up new server for a fixed number of rounds. Reply
        //    TIMEOUT if new server does not make progress for an
        //    election timeout or if the last round takes longer than
        //    the election timeout (4.2.1)
        // 3. Wait until previous configuration in the log is
        //    committed (4.1)
        if (pendingConfigChange) {
            callback({status: 'PENDING_CONFIG_CHANGE',
                      leaderHint: leaderId});
            return;
        }

        // NOTE: addition to Raft algorithm. If server is not in
        // serverData we cannot connect to it so reject it.
        if (!(args.newServer in opts.serverData)) {
            callback({status: 'NO_CONNECTION_INFO',
                      leaderHint: leaderId});
            return;
        }

        // NOTE: addition to Raft algorithm. If server is already
        // a member, reject it.
        if (args.newServer in self.serverMap) {
            callback({status: 'ALREADY_A_MEMBER',
                      leaderHint: leaderId});
            return;
        }

        // 4. Append new configuration entry to the log (old
        //    configuration plus newServer), commit it using majority
        //    of new configuration (4.1)
        pendingConfigChange = true;
        addEntries([{oldServers: servers(),
                     newServer: args.newServer}]);
        clientCallbacks[self.log.length-1] = function() {
            pendingConfigChange = false;
            // 5. Reply OK
            callback({status: 'OK',
                      leaderHint: leaderId});
        };
        update_indexes();
        pendingPersist = true;
        // trigger leader heartbeat
        setTimeout(leader_heartbeat,1);
    }

    // removeServer (Figure 4.1)
    //   args keys: oldServer (id)
    //   response: status, leaderHint
    function removeServer(args) {
        self.dbg("removeServer:", JSON.stringify(args));
        // 1. Reply NOT_LEADER if not leader (6.2)
        if (self.state !== 'leader') {
            callback({status: 'NOT_LEADER',
                      leaderHint: leaderId});
            return;
        }

        // NOTE: this is an addition to the Raft algorithm:
        // Instead of doing step 2, just reject config changes while
        // an existing one is pending.

        // 2. Wait until previous configuration in the log is
        //    committed (4.1)
        if (pendingConfigChange) {
            callback({status: 'PENDING_CONFIG_CHANGE',
                      leaderHint: leaderId});
            return;
        }

        // NOTE: addition to Raft algorithm. If server is not in the
        // map, reject it.
        if (!args.oldServer in self.serverMap) {
            callback({status: 'NOT_A_MEMBER',
                      leaderHint: leaderId});
            return;
        }

        // 3. Append new configuration entry to the log (old
        //    configuration without oldServer), commit it using
        //    majority of new configuration (4.1)
        pendingConfigChange = true;
        addEntries([{oldServers: servers(),
                     oldServer: args.oldServer}]);
        clientCallbacks[self.log.length-1] = function() {
            pendingConfigChange = false;
            // 4. Reply OK, and if this server was removed, step down
            //    (4.2.2)
            // TODO: step down and terminate
            callback({status: 'OK',
                      leaderHint: leaderId});
        };
        update_indexes();
        pendingPersist = true;
        // trigger leader heartbeat
        setTimeout(leader_heartbeat,1);
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
        callback = callback || function() {};
        if (self.state !== 'leader') {
            // tell the client to use a different server
            callback({'status': 'NOT_LEADER',
                      'leaderHint': leaderId});
            return;
        }
        // NOTE: this is an addition to the basic Raft algorithm:
        // Read-only operations are applied immediately against the
        // current state of the stateMachine (i.e. committed state)
        // and are not added to the log. Otherwise, the cmd is added
        // to the log and the client callback will be called when the
        // cmd is is committed. See 8
        cmd = copyMap(cmd);
        if (cmd.ro) {
            var result = opts.applyCmd(self.stateMachine, cmd);
            callback({status: 'success',
                      result: result});
        } else {
            clientCallbacks[self.log.length] = callback;
            addEntries([{command: cmd}]);
            pendingPersist = true;
            // trigger leader heartbeat
            setTimeout(leader_heartbeat,1);
        }
    }


    // Initialization: load any durable state from storage, become
    // a follower and start the election timeout timer. Schedule it to
    // happen immediately after the constructor returns.
    opts.schedule(function() {
        info("Initializing");
        loadBefore(function() {
            info("Initialized");
        });
    }, 0, {type:"Initialize"});


    // Public API/RPCs
    api = {requestVote:           requestVote,
           requestVoteResponse:   requestVoteResponse,
           appendEntries:         appendEntries,
           appendEntriesResponse: appendEntriesResponse,
           addServer:             addServer,
           removeServer:          removeServer,
           clientRequest:         clientRequest};
           //changeMembership:      changeMembership};
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
