#!/usr/bin/env bash
# test-server.sh — post-deployment smoke tests for the show_position MCP tool.
# Usage: ./test-server.sh [base-url]
# Default base URL: http://localhost:8787
set -euo pipefail

BASE_URL="${1:-http://localhost:8787}"
MCP_URL="$BASE_URL/mcp"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

mcp_call() {
  local id="$1"
  local args_json="$2"
  curl -s -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"show_position\",\"arguments\":$args_json},\"id\":$id}"
}

expect_ok() {
  local label="$1"
  local result="$2"
  local check="$3"   # substring that must appear in structuredContent
  if echo "$result" | grep -q '"isError":true'; then
    echo -e "${RED}FAIL${NC}  $label"
    echo "       response: $result"
    FAIL=$((FAIL+1))
  elif echo "$result" | grep -q "$check"; then
    echo -e "${GREEN}PASS${NC}  $label"
    PASS=$((PASS+1))
  else
    echo -e "${YELLOW}WARN${NC}  $label — expected '$check' not found"
    echo "       response: $result"
    FAIL=$((FAIL+1))
  fi
}

expect_error() {
  local label="$1"
  local result="$2"
  local check="$3"   # substring that must appear in the error message
  if echo "$result" | grep -q '"isError":true' && echo "$result" | grep -q "$check"; then
    echo -e "${GREEN}PASS${NC}  $label"
    PASS=$((PASS+1))
  else
    echo -e "${RED}FAIL${NC}  $label — expected error containing '$check'"
    echo "       response: $result"
    FAIL=$((FAIL+1))
  fi
}

# ---------------------------------------------------------------------------
# Wait for server
# ---------------------------------------------------------------------------

echo "Waiting for server at $MCP_URL …"
for i in $(seq 1 20); do
  if curl -s "$MCP_URL" > /dev/null 2>&1; then
    echo "Server is up."
    break
  fi
  sleep 0.5
done

echo ""
echo "Running show_position smoke tests"
echo "=================================="

# ---------------------------------------------------------------------------
# 1. Starting position (empty input)
# ---------------------------------------------------------------------------
R=$(mcp_call 1 '{}')
expect_ok \
  "1. Startstillingen — tom input gir standard FEN" \
  "$R" \
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq"

# ---------------------------------------------------------------------------
# 2. After 1.e4 — highlight e4, lastMove e2→e4
# ---------------------------------------------------------------------------
R=$(mcp_call 2 '{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "highlights": ["e4"],
  "lastMove": {"from": "e2", "to": "e4"},
  "caption": "Etter 1. e4"
}')
expect_ok \
  "2. Etter 1. e4 — highlight e4 og siste trekk e2–e4" \
  "$R" \
  '"e4"'

# ---------------------------------------------------------------------------
# 3. Same FEN from Black's side
# ---------------------------------------------------------------------------
R=$(mcp_call 3 '{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "orientation": "black",
  "caption": "Sett fra svarts perspektiv"
}')
expect_ok \
  "3. FEN fra svart sin side — orientation=black" \
  "$R" \
  '"orientation":"black"'

# ---------------------------------------------------------------------------
# 4. Arrows g1→f3 and f1→c4
# ---------------------------------------------------------------------------
R=$(mcp_call 4 '{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "arrows": [
    {"from": "g1", "to": "f3", "label": "Nf3"},
    {"from": "f1", "to": "c4", "label": "Bc4"}
  ],
  "caption": "Klassiske utviklingstrekk for hvit"
}')
expect_ok \
  "4. Piler g1→f3 og f1→c4" \
  "$R" \
  '"from":"g1"'

# ---------------------------------------------------------------------------
# 5. Invalid square z9 — should return isError
# ---------------------------------------------------------------------------
R=$(mcp_call 5 '{
  "highlights": ["z9"]
}')
expect_error \
  "5. Ugyldig rute z9 — skal gi feil" \
  "$R" \
  "z9"

# ---------------------------------------------------------------------------
# 6. Invalid FEN — should return isError
# ---------------------------------------------------------------------------
R=$(mcp_call 6 '{
  "fen": "this-is-not-a-fen"
}')
expect_error \
  "6. Ugyldig FEN — skal gi feil" \
  "$R" \
  "Invalid FEN"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=================================="
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo ""
if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
