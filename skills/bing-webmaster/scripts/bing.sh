#!/bin/bash
# Bing Webmaster Tools reader for the site in $BING_SITE_URL.
# Auth: $BING_WEBMASTER_API_KEY. Output is JSON on stdout.
#
# Usage:
#   bing.sh traffic            # GetRankAndTrafficStats: daily clicks and impressions
#   bing.sh queries            # GetQueryStats: top queries
#   bing.sh crawl              # GetCrawlStats: crawl errors and counts
#   bing.sh pages              # GetPageStats: top pages
#   bing.sh <MethodName>       # any other json.svc method that takes only siteUrl
#
# Dates come back as /Date(<ms since epoch>)/.
set -euo pipefail

: "${BING_WEBMASTER_API_KEY:?BING_WEBMASTER_API_KEY is not set}"
SITE="${BING_SITE_URL:?BING_SITE_URL is not set (e.g. https://example.com/)}"
BASE="https://ssl.bing.com/webmaster/api.svc/json"

case "${1:-}" in
  traffic) METHOD=GetRankAndTrafficStats ;;
  queries) METHOD=GetQueryStats ;;
  crawl)   METHOD=GetCrawlStats ;;
  pages)   METHOD=GetPageStats ;;
  "")      sed -n '2,12p' "$0" >&2; exit 2 ;;
  *)       METHOD="$1" ;;
esac
[[ "$METHOD" =~ ^[A-Za-z0-9]+$ ]] || { echo "bing.sh: invalid method name" >&2; exit 2; }

SITE_ENC=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$SITE")
curl -sS --fail -K - <<EOF
url = "${BASE}/${METHOD}?siteUrl=${SITE_ENC}&apikey=${BING_WEBMASTER_API_KEY}"
EOF
echo
