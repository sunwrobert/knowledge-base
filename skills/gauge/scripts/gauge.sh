#!/bin/bash
# Gauge (app.withgauge.com) MCP caller. Stateless JSON-RPC over HTTP, no handshake.
# Auth: $GAUGE_API_KEY. Output is the JSON-RPC response on stdout.
#
# Usage:
#   gauge.sh tools                          # list tools
#   gauge.sh call <tool> '<json arguments>' # call one tool
#
# Examples:
#   gauge.sh call list_categories '{}'
#   gauge.sh call get_performance_over_time '{"category_id":ID,"start_date":"2026-08-01","end_date":"2026-08-28","tracking_type":"visibility"}'
#   gauge.sh call run_ga4_report '{"dimensions":["date"],"metrics":["sessions"],"start_date":"2026-08-01","end_date":"2026-08-07","dimension_filters":[],"filter_logic":"and","order_by":"","limit":50,"property_id":null}'
set -euo pipefail

: "${GAUGE_API_KEY:?GAUGE_API_KEY is not set}"
ENDPOINT="${GAUGE_MCP_URL:-https://app.withgauge.com/mcp}"

case "${1:-}" in
  tools) BODY='{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' ;;
  call)
    TOOL="${2:?tool name required}"
    ARGS="${3:-{\}}"
    BODY=$(python3 -c 'import json,sys;print(json.dumps({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":sys.argv[1],"arguments":json.loads(sys.argv[2])}}))' "$TOOL" "$ARGS")
    ;;
  *) sed -n '2,12p' "$0" >&2; exit 2 ;;
esac

RESP=$(curl -sS --fail -X POST "$ENDPOINT" \
  -H "Authorization: Bearer ${GAUGE_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "$BODY")

# Server may answer as plain JSON or as an SSE stream; print the JSON-RPC response for id 1.
printf '%s\n' "$RESP" | python3 -c '
import json, sys
raw = sys.stdin.read()
if not raw.lstrip().startswith(("event:", "data:")):
    sys.stdout.write(raw)
    sys.exit(0)
for event in raw.replace("\r\n", "\n").replace("\r", "\n").split("\n\n"):
    data = "".join(l[5:].lstrip() for l in event.splitlines() if l.startswith("data:"))
    if not data:
        continue
    try:
        msg = json.loads(data)
    except ValueError:
        continue
    if isinstance(msg, dict) and msg.get("id") == 1:
        print(data)
        sys.exit(0)
sys.exit("gauge.sh: no JSON-RPC response with id 1 in SSE stream")
'
