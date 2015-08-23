# dockerhub - A repository for various dockerfiles
# For more information; http://github.com/cmfatih/dockerhub
#
# SlimerJS
#
# Test
#   sudo docker run fentas/slimerjs /usr/bin/slimerjs -v
#   sudo docker run fentas/slimerjs /usr/bin/casperjs | head -n 1
#   sudo docker run -v `pwd`:/mnt/test fentas/slimerjs /usr/bin/slimerjs /mnt/test/test.js

# VERSION 1.0.1

FROM ubuntu:12.04

MAINTAINER fentas <jan.guth.so>

# Env
ENV SLIMERJS_VERSION_F 0.9.6
ENV CASPERJS_VERSION_T master

# Commands
RUN \
  apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y vim git wget xvfb libxrender-dev libasound2 libdbus-glib-1-2 libgtk2.0-0 bzip2 && \
  mkdir -p /srv/var && \
  wget -O /tmp/slimerjs-$SLIMERJS_VERSION_F-linux-x86_64.tar.bz2 http://download.slimerjs.org/releases/$SLIMERJS_VERSION_F/slimerjs-$SLIMERJS_VERSION_F-linux-x86_64.tar.bz2 && \
  tar -xjf /tmp/slimerjs-$SLIMERJS_VERSION_F-linux-x86_64.tar.bz2 -C /tmp && \
  rm -f /tmp/slimerjs-$SLIMERJS_VERSION_F-linux-x86_64.tar.bz2 && \
  mv /tmp/slimerjs-$SLIMERJS_VERSION_F/ /srv/var/slimerjs && \
  echo '#!/bin/bash\nxvfb-run /srv/var/slimerjs/slimerjs $*' > /srv/var/slimerjs/slimerjs.sh && \
  chmod 755 /srv/var/slimerjs/slimerjs.sh && \
  ln -s /srv/var/slimerjs/slimerjs.sh /usr/bin/slimerjs && \
  git clone https://github.com/n1k0/casperjs.git /srv/var/casperjs && \
  cd /srv/var/casperjs && \
  git checkout $CASPERJS_VERSION_T && \
  echo '#!/bin/bash\n/srv/var/casperjs/bin/casperjs --engine=slimerjs $*' >> /srv/var/casperjs/casperjs.sh && \
  chmod 755 /srv/var/casperjs/casperjs.sh && \
  ln -s /srv/var/casperjs/casperjs.sh /usr/bin/casperjs && \
  apt-get autoremove -y && \
  apt-get clean all

# Default command
CMD ["/usr/bin/slimerjs"]
