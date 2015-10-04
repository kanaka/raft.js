"use strict";
var talk = document.getElementById('talk'),
    send = document.getElementById('send'),
    chat_history = document.getElementById('chat_history');

function updateHistory() {
    var lines = node._self.stateMachine['history'];
    if (lines) {
        chat_history.innerHTML = lines.value.join("\n");
    }
}

function applyCmd(stateMachine, cmd) {
    //log("applyCmd:", JSON.stringify(cmd));
    switch (cmd.op) {
        case 'get':
            stateMachine[cmd.key];
            return stateMachine[cmd.key];
        case 'set':
            stateMachine[cmd.key] = cmd.value;
            return stateMachine[cmd.key];
        case 'seqAppend':
            // Returns a tuple of [success, curCnt, msg] or an
            // exception if the command is not a valid appendSeq or
            // the target key is not a sequence.
            if (!'key' in cmd) { throw new Error("seqAppend missing 'key'") }
            if (!'value' in cmd) { throw new Error("seqAppend missing 'value'") }
            if (!'cnt' in cmd) { throw new Error("seqAppend missing 'cnt'") }

            // Add the sequence key if it's not already there
            if (!(cmd.key in stateMachine)) {
                stateMachine[cmd.key] = {cnt: 0, value: []};
            }

            var seq = stateMachine[cmd.key];
            if (!('cnt' in seq && 'value' in seq)) {
                throw new Error("seqAppend on non-sequence");
            }
            if (cmd.cnt !== seq.cnt) {
                return [false, seq.cnt];
            } else {
                seq.value.push(cmd.value);
                seq.cnt += 1;
                setTimeout(updateHistory, 1);
                return [true, seq.cnt];
            }
    }
}

var sendTimeout = 100,
    sendTimer = null,
    curSeqCnt = 0,
    curSend = null,
    pendingSends = [];

function flushSends() {
    sendTimer = setTimeout(flushSends, sendTimeout);
    if (curSend || pendingSends.length === 0) { return; }
    var curSend = pendingSends.shift(),
        req = {op: 'seqAppend',
               key: 'history',
               cnt: curSeqCnt,
               value: curSend};
    clientRequest(req, function(result) {
        //console.log("result:", JSON.stringify(result));
        if (result.status !== 'success' || result.result[0] === false) {
            console.log("retrying seqAppend with cnt: " + result.result[1]);
            pendingSends.unshift(curSend);
        } else {
            // After a successful send, try again immediately
            clearTimeout(sendTimer);
            sendTimer = setTimeout(flushSends, 1);
        }
        curSend = null;
        curSeqCnt = result.result[1];
    });
}

function sendLine() {
    var line = nodeId + ": " + talk.value;
    talk.value = "";
    pendingSends.push(line);
}

function startChat() {
    send.onclick = sendLine;
    // Also send on enter
    talk.onkeyup = function(e) {
        if (e.keyCode === 13) {
            sendLine();
        }
    };
    startRaft({applyCmd: applyCmd});
    flushSends();

}
