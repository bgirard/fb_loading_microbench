#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

npm install express
node server.js
