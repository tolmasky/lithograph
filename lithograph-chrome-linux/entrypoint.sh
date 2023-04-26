#!/bin/sh

set -ex

CAs="/certificate-authorities"

for CA in "$CAs"/*.crt; do
    if [ -e "$CA" ]; then
        certutil -d sql:/home/chromeuser/.pki/nssdb -A -t "CT,C,C" -n CertCA -i "$CA"
    fi
done


exec "$@"
