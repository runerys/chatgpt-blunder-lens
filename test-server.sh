#!/usr/bin/env bash
set -e

cd /mnt/c/Users/wr1026/github/runerys/chatgpt-blunder-lens

node server/dist/index.js &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
for i in $(seq 1 10); do
  if curl -s http://localhost:8787/mcp > /dev/null 2>&1; then
    echo "Server is up"
    break
  fi
  sleep 0.5
done

echo ""
echo "=== tools/call show_position (empty input) ==="
RESULT=$(curl -s -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"show_position","arguments":{}},"id":1}')
echo "$RESULT"

echo ""
echo "=== tools/call show_position (bad FEN) ==="
RESULT2=$(curl -s -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"show_position","arguments":{"fen":"not-a-fen"}},"id":2}')
echo "$RESULT2"

kill $SERVER_PID 2>/dev/null || true
echo "Done."
