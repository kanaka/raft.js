#!/bin/bash

for id in $(docker ps -a | grep slimerjs-wily | awk '{print $1}'); do
    echo "Removing ${id}"
    docker rm -f ${id}
done
