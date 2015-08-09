"use strict";

function applyCmd(stateMachine, cmd) {
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
            if (cmd.key in stateMachine) {
                if (!'cnt' in cmd) { throw new Error("seqAppend missing 'cnt'") }
                var seq = stateMachine[cmd.key];
                if (!('cnt' in seq && 'value' in seq)) {
                    throw new Error("seqAppend on non-sequence");
                }
                if (cmd.cnt !== seq.cnt) {
                    return [false, seq.cnt];
                } else {
                    seq.value.push(cmd.value);
                    seq.cnt += 1;
                    return [true, seq.cnt];
                }
            } else {
                stateMachine[cmd.key] = {cnt: 0, value: [cmd.value]};
                return [true, 0];
            }
    }
}

var sendTimeout = 100,
    curSeqCnt = 0,
    curSend = null,
    pendingSends = [];

function flushSends() {
    setTimeout(flushSends, sendTimeout);
    if (curSend || pendingSends.length === 0) { return; }
    console.log("here1:", pendingSends);
    var curSend = pendingSends.shift(),
        req = {op: 'seqAppend',
               key: 'history',
               cnt: curSeqCnt,
               value: curSend};
    clientRequest(req, function(result) {
        console.log("result:", JSON.stringify(result));
        if (result.status !== 'success' || result.result[0] === false) {
            pendingSends.unshift(curSend);
        }
        curSend = null;
        curSeqCnt = result.result[1];
    });
}

function startChat() {
    var talk = document.getElementById('talk'),
        send = document.getElementById('send');
    send.onclick = function() {
        console.log("talk.value:", talk.value);
        pendingSends.push(talk.value); 
        talk.value = "";
    };
    start({applyCmd: applyCmd});
    flushSends();

}
