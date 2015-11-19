#!/bin/bash

set -e

cd test

echo "Collecting start data"
./scripts/process.py ../research_class/data/start_et1000 "is up after" start_et1000 $(ls -v data_et1000/w*-{1..41..2}-*)
./scripts/process.py ../research_class/data/start_et500 "is up after" start_et500 $(ls -v data_et500/w*-{1..41..2}-*)
#./scripts/process.py ../research_class/data/start_et500_fail "timeout waiting for clients" start_et500_fail $(ls -v data_et500/w*-{1..41..2}-*)
./scripts/process.py ../research_class/data/start_et250 "is up after" start_et250 $(ls -v data_et250/w*-{1..41..2}-*)

echo "Collecting propagate_1 data"
./scripts/process.py ../research_class/data/propagate_1 "propagated after" propagate_1_et1000 $(ls -v data_et1000/wcp-1-*)
echo "Collecting propagate_100 data"
./scripts/process.py ../research_class/data/propagate_100 "propagated after" propagate_100_et1000 $(ls -v data_et1000/wcp-100-*)

echo "Collecting kill_1 data"
./scripts/process.py ../research_class/data/kill_1_et1000 "recovered after" kill_1_et1000 $(ls -v data_et1000/wkn-1-*)
./scripts/process.py ../research_class/data/kill_1_et500 "recovered after" kill_1_et500 $(ls -v data_et500/wkn-1-*)
./scripts/process.py ../research_class/data/kill_1_et250 "recovered after" kill_1_et250 $(ls -v data_et250/wkn-1-*)

echo "Collecting kill_half data"
./scripts/process.py ../research_class/data/kill_half_et1000 "recovered after" kill_half_et1000 $(ls -v data_et1000/wkn-half-*)
./scripts/process.py ../research_class/data/kill_half_et500 "recovered after" kill_half_et500 $(ls -v data_et500/wkn-half-*)
./scripts/process.py ../research_class/data/kill_half_et250 "recovered after" kill_half_et250 $(ls -v data_et250/wkn-half-*)

