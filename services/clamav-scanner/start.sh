#!/bin/sh
set -eu

: "${SCANNER_AUTH_TOKEN:?SCANNER_AUTH_TOKEN must be set}"
clamd &
clamd_pid=$!

attempt=0
while [ "$attempt" -lt 10 ]; do
  if ! kill -0 "$clamd_pid" >/dev/null 2>&1; then
    echo 'ClamAV exited before becoming ready' >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done

node /service/server.mjs &
node_pid=$!
trap 'kill "$node_pid" "$clamd_pid" 2>/dev/null || true' INT TERM
wait "$node_pid"
