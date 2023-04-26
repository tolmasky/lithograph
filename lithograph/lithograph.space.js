#!/usr/bin/env -S spacekit run

module.exports = (...args) =>
({
    network: "host",
    capabilities: ["SYS_ADMIN"],
    tty: true,
    command: [...args],
    volumes:
    [
        { from:require("path").resolve(process.env.PWD, "."), to:"/all", readonly: true },
        { from:"/var/run/docker.sock", to:"/var/run/docker.sock" }
    ],
    dockerfileContents:`
FROM buildpack-deps:jammy

RUN apt-get update && apt-get install -y \
    lsb-release

# Docker
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg

RUN echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

# From https://docs.docker.com/engine/release-notes/20.10/#201023
# Then doing apt-cache madison docker-ce, docker-ce-cli, etc.
RUN apt-get update
RUN apt-get install -y \
    docker-ce=5:20.10.23~3-0~ubuntu-jammy \
    docker-ce-cli=5:20.10.23~3-0~ubuntu-jammy \
    containerd.io=1.6.18-1 \
    docker-compose-plugin=2.14.1~ubuntu-jammy

ENV NODE_VERSION 18.15.0

# Node
# From https://github.com/nodejs/docker-node/blob/main/18/bullseye-slim/Dockerfile
RUN ARCH= && dpkgArch="$(dpkg --print-architecture)" \
    && case "$\{dpkgArch##*-}" in \
      amd64) ARCH='x64';; \
      ppc64el) ARCH='ppc64le';; \
      s390x) ARCH='s390x';; \
      arm64) ARCH='arm64';; \
      armhf) ARCH='armv7l';; \
      i386) ARCH='x86';; \
      *) echo "unsupported architecture"; exit 1 ;; \
    esac \
    && set -ex \
    && apt-get update && apt-get install -y ca-certificates curl wget gnupg dirmngr xz-utils libatomic1 --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && for key in \
      4ED778F539E3634C779C87C6D7062848A1AB005C \
      141F07595B7B3FFE74309A937405533BE57C7D57 \
      74F12602B6F1C4E913FAA37AD3A89613643B6201 \
      61FC681DFB92A079F1685E77973F295594EC4689 \
      8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600 \
      C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
      890C08DB8579162FEE0DF9DB8BEAB4DFCF555EF4 \
      C82FA3AE1CBEDC6BE46B9360C43CEC45C17AB93C \
      108F52B48DB57BB0CC439B2997B01419BD92F80A \
    ; do \
      gpg --batch --keyserver hkps://keys.openpgp.org --recv-keys "$key" || \
      gpg --batch --keyserver keyserver.ubuntu.com --recv-keys "$key" ; \
    done \
    && curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.xz" \
    && curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
    && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
    && grep " node-v$NODE_VERSION-linux-$ARCH.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
    && tar -xJf "node-v$NODE_VERSION-linux-$ARCH.tar.xz" -C /usr/local --strip-components=1 --no-same-owner \
    && rm "node-v$NODE_VERSION-linux-$ARCH.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
    && node --version \
    && npm --version

RUN npm install npm@9.6.2 --location=global

RUN npm install to-clf --location=global
RUN npm install magic-ws --location=global

RUN ln -s /all/@spacekit/spacekit/spacekit.js /usr/bin/spacekit

WORKDIR /all
`
});
