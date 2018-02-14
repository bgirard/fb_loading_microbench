#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

if ! which npm >/dev/null; then
  echo "npm not installed: See https://www.npmjs.com/get-npm"
  exit 1
fi

npm install express
node server.js
