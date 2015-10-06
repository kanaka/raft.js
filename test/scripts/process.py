#!/usr/bin/env python

from __future__ import print_function

import os, sys
fprefix = sys.argv[1]
match = sys.argv[2]
tag = sys.argv[3]
files = sys.argv[4:]

out = open(fprefix+".dat", "w")
out.write("nodes time label\n")

grouped = {}
for file in files:
    lines = open(file).readlines()
    matches = filter(lambda x:match in x, lines)
    if not matches:
        print("no matching line in '%s'" % file, file=sys.stderr)
        continue
    line = matches[0].rstrip()
    ms = int(line.split()[-1][:-2])
    secs = ms / 1000.0
    [type, subtype, size, attempt] = file.split('-')
    size = int(size)

    #print(file, type, subtype, size, attempt, secs, ":", line, file=sys.stderr)

    out.write("%s %s %s\n" % (size, secs, tag))

    if not grouped.has_key(size):
        grouped[size] = []

    grouped[size].append(secs)

out_avg = open(fprefix+"_average.dat", "w")
out_avg.write("nodes time label\n")

for size in sorted(grouped.keys()):
    times = grouped[size]
    avg = sum(times) / len(times)
    out_avg.write("%s %s %s\n" % (size, avg, tag+"_average"))
