#!/usr/bin/env python

from __future__ import print_function

import os, sys
match = sys.argv[1]
tag = sys.argv[2]
files = sys.argv[3:]

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

    print("%s %s %s" % (size, secs, tag))

    if not grouped.has_key(size):
        grouped[size] = []

    grouped[size].append(secs)

for size in sorted(grouped.keys()):
    times = grouped[size]
    avg = sum(times) / len(times)
    print("%s %s %s" % (size, avg, tag+"_average"))
