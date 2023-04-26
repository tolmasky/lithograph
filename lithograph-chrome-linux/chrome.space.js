#!/usr/bin/env -S spacekit run

module.exports = (...args) =>
({
    network: "host",
    capabilities: ["SYS_ADMIN"],
    command: ["google-chrome-stable", ...args],
    dockerfileContents:`
FROM buildpack-deps:focal

# Version 1.1
RUN echo "hi"
# Install latest chrome dev package and fonts to support major charsets
# (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of
# Chromium that Puppeteer installs, work.

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y \
        google-chrome-stable \
        fonts-ipafont-gothic \
        fonts-wqy-zenhei \
        fonts-thai-tlwg \
        fonts-kacst \
        fonts-freefont-ttf \
        libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install libnss3-tools

RUN groupadd -r chromeuser && \
    useradd \
    --create-home \
    --no-log-init \
    -r -g chromeuser -G audio,video chromeuser

WORKDIR /home/chromeuser

COPY entrypoint.sh entrypoint.sh

RUN mkdir -p Downloads local-ssl user-data

RUN touch local-ssl/public.crt

RUN mkdir -p .pki/nssdb \
    && certutil -d /home/chromeuser/.pki/nssdb -N --empty-password \
    && certutil -d sql:/home/chromeuser/.pki/nssdb -L

RUN chown -R chromeuser:chromeuser /home/chromeuser

USER chromeuser

ENTRYPOINT ["/home/chromeuser/entrypoint.sh"]
`
});
