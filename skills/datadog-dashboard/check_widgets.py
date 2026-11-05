#!/usr/bin/env python3
"""Run every formula query on a Datadog dashboard and report widgets that return no data.

Each request is replayed over the widget's window at 20 points with each formula limited to its top series,
which is enough to tell data from no data and keeps wide grouped timeseries small.

Usage: DD_SITE=... DD_API_KEY=... DD_APP_KEY=... python3 check_widgets.py <dashboard-id> [--hours 24] [--restricted <service>]
Exit code 1 if any request of any widget is empty, errors, uses an unsupported format, or names a --restricted service
without excluding it. Template variables resolve to their defaults; a widget with its own time.live_span is queried over
that span instead of --hours, and --force-hours overrides every widget's window.
"""

import argparse
import http.client
import itertools
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

SITE = os.environ.get("DD_SITE", "datadoghq.com")
API = f"https://api.{SITE}"
UI = f"https://app.{SITE}" if SITE.count(".") == 1 else f"https://{SITE}"


def call(method, path, body=None):
    request = urllib.request.Request(
        API + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={
            "DD-API-KEY": os.environ["DD_API_KEY"],
            "DD-APPLICATION-KEY": os.environ["DD_APP_KEY"],
            "Content-Type": "application/json",
        },
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise
            time.sleep(int(error.headers.get("X-RateLimit-Reset", "5")))
        except http.client.IncompleteRead:
            if attempt == 4:
                raise
            time.sleep(5)


def leaf_widgets(widgets):
    for widget in widgets:
        definition = widget["definition"]
        if definition["type"] == "group":
            yield from leaf_widgets(definition["widgets"])
        else:
            yield definition


def selections(tvars):
    """Each combination of single default values; a multi-default variable has data if any of its values does."""
    names = list(tvars)
    for values in itertools.product(*(tvars[name][1] for name in names)):
        yield {name: (tvars[name][0], value) for name, value in zip(names, values)}


def substitute(value, tvars):
    if isinstance(value, str):
        for name, (prefix, default) in tvars.items():
            value = value.replace(f"${name}.value", default)
            value = re.sub(rf"([\w.@-]+):\${re.escape(name)}(?![\w.])", lambda match: f"{match[1]}:{default}", value)
            value = re.sub(rf"\${re.escape(name)}(?![\w.])", "*" if default == "*" else f"{prefix}:{default}", value)
        return value
    if isinstance(value, list):
        return [substitute(item, tvars) for item in value]
    if isinstance(value, dict):
        return {key: substitute(item, tvars) for key, item in value.items()}
    return value


def tvar_defaults(dashboard):
    tvars = {}
    for tvar in dashboard.get("template_variables", []):
        selected = tvar.get("defaults") or [tvar.get("default") or "*"]
        tvars[tvar["name"]] = (tvar.get("prefix") or tvar["name"], selected)
    return dict(sorted(tvars.items(), key=lambda item: -len(item[0])))


LIVE_SPAN_MS = {"m": 60_000, "h": 3_600_000, "d": 86_400_000, "w": 604_800_000, "mo": 2_592_000_000, "y": 31_536_000_000}
UNIT_MS = {"minute": 60_000, "hour": 3_600_000, "day": 86_400_000, "week": 604_800_000, "month": 2_592_000_000, "year": 31_536_000_000}


def widget_span_ms(definition):
    time_spec = definition.get("time") or {}
    match = re.fullmatch(r"(\d+)(mo|m|h|d|w|y)", time_spec.get("live_span", ""))
    if match:
        return int(match[1]) * LIVE_SPAN_MS[match[2]]
    if time_spec.get("type") == "live" and time_spec.get("unit") in UNIT_MS:
        return int(time_spec["value"]) * UNIT_MS[time_spec["unit"]]
    return None


def populated_formulas(kind, response):
    attributes = response.get("data", {}).get("attributes", {})
    if kind == "timeseries":
        series = zip(attributes.get("series", []), attributes.get("values", []))
        return {meta.get("query_index", 0) for meta, values in series if any(value is not None for value in values)}
    numbers = [column for column in attributes.get("columns", []) if column.get("type") != "group"]
    return {index for index, column in enumerate(numbers) if any(value is not None for value in column.get("values", []))}


def request_has_data(kind, request, tvars, start, end):
    populated = set()
    for selection in selections(tvars):
        body = {
            "data": {
                "type": f"{kind}_request",
                "attributes": {
                    "from": start,
                    "to": end,
                    "queries": substitute(request["queries"], selection),
                    "formulas": [
                        {"formula": formula, "limit": {"count": 1, "order": "desc"}}
                        for formula in [formula["formula"] for formula in request.get("formulas", [])]
                        or [query["name"] for query in request["queries"]]
                    ],
                },
            }
        }
        if kind == "timeseries":
            body["data"]["attributes"]["interval"] = max(60_000, (end - start) // 20)
        populated |= populated_formulas(kind, call("POST", f"/api/v2/query/{kind}", body))
        if len(populated) == len(body["data"]["attributes"]["formulas"]):
            return True
    return False


def names_restricted(text, restricted):
    for name in restricted:
        escaped = re.escape(name)
        text = re.sub(rf"-[\w.@-]+:{escaped}(?![\w-])", "", text)
        if re.search(rf"(?<![\w-]){escaped}(?![\w-])", text):
            return True
    return False


def check(definition, tvars, default_span_ms, forced_span_ms, end, restricted):
    requests = definition.get("requests", [])
    if isinstance(requests, dict):
        requests = list(requests.values())
    if not any(request.get("queries") or "q" in request for request in requests):
        return "skip"
    if any("q" in request for request in requests):
        return "unsupported (legacy q request; re-save in the UI or replay it by hand)"
    requests = [request for request in requests if request.get("queries")]
    replayed = [substitute(request["queries"], selection) for request in requests for selection in selections(tvars)]
    unquoted = json.dumps(replayed).replace('\\"', "").replace("'", "")
    if names_restricted(unquoted, restricted):
        return "refused (queries a restricted service; hand this widget to a human)"
    start = end - (forced_span_ms or widget_span_ms(definition) or default_span_ms)
    kind = "timeseries" if definition["type"] == "timeseries" else "scalar"
    empty = [index for index, request in enumerate(requests) if not request_has_data(kind, request, tvars, start, end)]
    if empty:
        return "empty" if len(requests) == 1 else f"empty (request {', '.join(map(str, empty))})"
    return "ok"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dashboard_id")
    parser.add_argument("--hours", type=int, default=24, help="window for widgets without their own live_span")
    parser.add_argument("--force-hours", type=int, help="window for every widget, overriding live_span")
    parser.add_argument("--restricted", action="append", default=[], help="service or tag value no widget may query unless it excludes it (repeatable)")
    args = parser.parse_args()
    dashboard = call("GET", f"/api/v1/dashboard/{args.dashboard_id}")
    tvars = tvar_defaults(dashboard)
    end = int(time.time() * 1000)
    failures = 0
    for definition in leaf_widgets(dashboard["widgets"]):
        title = definition.get("title") or definition["type"]
        try:
            status = check(definition, tvars, args.hours * 3_600_000, args.force_hours and args.force_hours * 3_600_000, end, args.restricted)
        except urllib.error.HTTPError as error:
            try:
                body = error.read().decode(errors="replace")[:200]
            except http.client.HTTPException:
                body = "(body unreadable)"
            status = f"error {error.code}: {body}"
        except (http.client.HTTPException, OSError, ValueError) as error:
            status = f"error {type(error).__name__}"
        if status != "skip":
            print(f"{status:<6} {definition['type']:<12} {title}")
        failures += status not in ("ok", "skip")
    print(f"{failures} widget(s) without data on {UI}/dashboard/{args.dashboard_id}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
