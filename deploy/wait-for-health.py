#!/usr/bin/env python3
"""Wait for a backend or freshly reloaded proxy to return its health response."""

import argparse
from http.client import HTTPException
import json
import math
import sys
import time
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener


def positive_seconds(value: str) -> float:
    seconds = float(value)
    if not math.isfinite(seconds) or seconds <= 0:
        raise argparse.ArgumentTypeError("Expected a positive finite duration")
    return seconds


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--timeout", type=positive_seconds, default=30.0)
    parser.add_argument("--interval", type=positive_seconds, default=1.0)
    args = parser.parse_args()
    if not args.url.startswith(("http://", "https://")):
        parser.error("Expected an HTTP or HTTPS URL")
    opener = build_opener(ProxyHandler({}))
    deadline = time.monotonic() + args.timeout
    last_error = "No response"
    while time.monotonic() < deadline:
        try:
            with opener.open(args.url, timeout=max(0.001, min(5, deadline - time.monotonic()))) as response:
                body = response.read(4097)
                if response.status == 200 and len(body) <= 4096:
                    payload = json.loads(body)
                    if isinstance(payload, dict) and payload.get("status") == "ok":
                        print(f"Healthy: {args.url}")
                        return 0
                last_error = "Response is not a healthy JSON status"
        except (URLError, OSError, ValueError, HTTPException) as error:
            last_error = str(error)
        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(args.interval, remaining))
    print(f"Health check timed out for {args.url}: {last_error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
