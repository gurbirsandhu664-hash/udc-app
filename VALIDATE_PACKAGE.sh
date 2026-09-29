#!/bin/sh
set -eu
node --check server.js
node -e "JSON.parse(require('fs').readFileSync('UDC_THIRD_PARTY_AUTHORITY_PACK.json','utf8')); console.log('Authority pack JSON: OK')"
echo 'V12.8 package validation: OK'
