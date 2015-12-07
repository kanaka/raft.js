#!/bin/bash

outdir=test/data_et1000

mkdir -p ${outdir}

# chat propagate 1 message:
time for x in $(seq 1 7); do for nodes in $(seq 1 2 35); do time node test/wait_chat_propagate.js 192.168.2.3:8001 ${nodes} 1 | tee ${outdir}/wcp-1-${nodes}-${x}; sleep 3; test/cleanup.sh; done; done

# chat propagate 100 messages:
time for x in $(seq 1 7); do for nodes in $(seq 1 2 35); do time node test/wait_chat_propagate.js 192.168.2.3:8001 ${nodes} 100 | tee ${outdir}/wcp-100-${nodes}-${x}; sleep 3; test/cleanup.sh; done; done

# kill 1 node:
time for x in $(seq 1 7); do for nodes in $(seq 1 2 35); do time node test/wait_kill_nodes.js 192.168.2.3:8001 ${nodes} 1 | tee ${outdir}/wkn-1-${nodes}-${x}; sleep 3; test/cleanup.sh; done; done

# kill half nodes:
time for x in $(seq 1 7); do for nodes in $(seq 1 2 35); do time node test/wait_kill_nodes.js 192.168.2.3:8001 ${nodes} | tee ${outdir}/wkn-half-${nodes}-${x}; sleep 3; test/cleanup.sh; done; done
