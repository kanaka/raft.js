#!/bin/bash

# chat propagate 1 message:
time for x in $(seq 1 7); do for nodes in $(seq 1 2 31); do time node test/wait_chat_propagate.js 192.168.2.3:8001 ${nodes} 1 | tee test/data_et1000/wcp-1-${nodes}-${x}; sleep 3; test/cleanup.sh; done; done

# chat propagate 100 messages:
time for x in $(seq 1 7); do for nodes in $(seq 1 2 31); do time node test/wait_chat_propagate.js 192.168.2.3:8001 ${nodes} 100 | tee test/data_et1000/wcp-100-${nodes}-${x}; sleep 3; test/cleanup.sh; done; done

# kill 1 node:
time for x in $(seq 1 7); do for nodes in $(seq 1 2 31); do time node test/wait_kill_nodes.js 192.168.2.3:8001 ${nodes} 1 | tee test/data_et1000/wkn-1-${nodes}-${x}; sleep 3; test/cleanup.sh; done; done

# kill half nodes (162min):
time for x in $(seq 1 7); do for nodes in $(seq 1 2 31); do time node test/wait_kill_nodes.js 192.168.2.3:8001 ${nodes} | tee test/data_et1000/wkn-half-${nodes}-${x}; sleep 3; test/cleanup.sh; done; done
