#!/usr/bin/env python3
"""Google Search Console reader for the property in $GSC_PROPERTY.

Auth: service-account JSON in $GSC_SERVICE_ACCOUNT_KEY (RS256 JWT -> access token).
Requires python3 and the `openssl` binary. Output is JSON on stdout.

Usage:
  gsc.py totals   START END                # sitewide clicks/impressions/ctr/position
  gsc.py dates    START END                # daily series (use to find latest final date)
  gsc.py pages    START END [LIMIT]        # top pages by clicks
  gsc.py queries  START END [LIMIT]        # top queries by clicks
  gsc.py page-queries START END URL [LIMIT]# queries for one page
  gsc.py sitemaps                          # submitted sitemaps and status
  gsc.py inspect  URL                      # URL inspection (index status)
  gsc.py raw      '<json body>'            # arbitrary searchAnalytics/query body

Env: GSC_PROPERTY (required, e.g. sc-domain:example.com or https://example.com/), GSC_DATA_STATE (default final).
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

PROPERTY = os.environ.get("GSC_PROPERTY") or sys.exit("gsc.py: GSC_PROPERTY is not set")
DATA_STATE = os.environ.get("GSC_DATA_STATE", "final")
ENC = urllib.parse.quote(PROPERTY, safe="")


def b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def access_token():
    sa = json.loads(os.environ["GSC_SERVICE_ACCOUNT_KEY"])
    now = int(time.time())
    header = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64(json.dumps({
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/webmasters.readonly",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }).encode())
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        os.fchmod(f.fileno(), 0o600)
        f.write(sa["private_key"])
        key_path = f.name
    try:
        sig = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=f"{header}.{claims}".encode(), capture_output=True, check=True,
        ).stdout
    finally:
        os.remove(key_path)
    jwt = f"{header}.{claims}.{b64(sig)}"
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt,
    }).encode()
    resp = urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=body))
    return json.loads(resp.read())["access_token"]


TOKEN = None


def call(url, body=None):
    global TOKEN
    if TOKEN is None:
        TOKEN = access_token()
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json",
    })
    return json.loads(urllib.request.urlopen(req).read())


def query(start, end, dimensions, row_limit=1000, extra=None):
    body = {"startDate": start, "endDate": end, "dataState": DATA_STATE,
            "dimensions": dimensions, "rowLimit": int(row_limit)}
    if extra:
        body.update(extra)
    return call(f"https://www.googleapis.com/webmasters/v3/sites/{ENC}/searchAnalytics/query", body)


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    cmd, args = argv[1], argv[2:]
    if cmd == "totals":
        out = query(args[0], args[1], [], 1)
    elif cmd == "dates":
        out = query(args[0], args[1], ["date"], 1000)
    elif cmd == "pages":
        out = query(args[0], args[1], ["page"], args[2] if len(args) > 2 else 25)
    elif cmd == "queries":
        out = query(args[0], args[1], ["query"], args[2] if len(args) > 2 else 25)
    elif cmd == "page-queries":
        flt = {"dimensionFilterGroups": [{"filters": [{"dimension": "page", "operator": "equals", "expression": args[2]}]}]}
        out = query(args[0], args[1], ["query"], args[3] if len(args) > 3 else 25, flt)
    elif cmd == "sitemaps":
        out = call(f"https://www.googleapis.com/webmasters/v3/sites/{ENC}/sitemaps")
    elif cmd == "inspect":
        out = call("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
                   {"inspectionUrl": args[0], "siteUrl": PROPERTY})
    elif cmd == "raw":
        out = call(f"https://www.googleapis.com/webmasters/v3/sites/{ENC}/searchAnalytics/query", json.loads(args[0]))
    else:
        print(__doc__)
        return 2
    json.dump(out, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
