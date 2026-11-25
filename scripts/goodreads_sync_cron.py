#!/usr/bin/env python3
"""
Host cron / LaunchAgent script for syncing Goodreads & Letterboxd shelves into Curio.
Uses Apple-signed /usr/bin/python3 -I (stdlib only, no third-party deps).
Never logs cookie secrets.
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CURIO_BASE_URL = os.environ.get("CURIO_BASE_URL", "http://127.0.0.1:3000/curio").rstrip("/")
SYNC_SECRET_PATH = Path(
    os.environ.get(
        "CURIO_SYNC_SECRET_PATH",
        str(Path.home() / "dockermounts/curio/.sync-secret"),
    )
)
GOODREADS_ENV_PATH = Path(
    os.environ.get(
        "GOODREADS_ENV_PATH",
        str(Path.home() / "Utilities/secrets/goodreads.env"),
    )
)
LETTERBOXD_ENV_PATH = Path(
    os.environ.get(
        "LETTERBOXD_ENV_PATH",
        str(Path.home() / "Utilities/secrets/letterboxd.env"),
    )
)
HEARTBEAT_SCRIPT = Path.home() / "Git/mini/Utilities/homepage/heartbeat.sh"


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        val = val.strip().strip('"').strip("'")
        values[key.strip()] = val
    return values


def emit_heartbeat(status: str) -> None:
    if HEARTBEAT_SCRIPT.is_file() and os.access(HEARTBEAT_SCRIPT, os.X_OK):
        try:
            subprocess.run(
                [str(HEARTBEAT_SCRIPT), "curio-goodreads-sync", status],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
            )
        except Exception:
            pass


def post_sync(endpoint: str, payload: dict[str, str], sync_secret: str) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{CURIO_BASE_URL}{endpoint}",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Curio-Sync-Secret": sync_secret,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        raw_err = err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw_err)
        except Exception:
            parsed = {"error": raw_err[:200]}
        return err.code, parsed


def main() -> int:
    ts = datetime.now(timezone.utc).isoformat()
    if not SYNC_SECRET_PATH.is_file():
        print(f"[{ts}] Sync secret not initialized at {SYNC_SECRET_PATH}; skipping.", file=sys.stderr)
        emit_heartbeat("fail")
        return 1

    sync_secret = SYNC_SECRET_PATH.read_text(encoding="utf-8").strip()
    if not sync_secret:
        print(f"[{ts}] Empty sync secret at {SYNC_SECRET_PATH}", file=sys.stderr)
        emit_heartbeat("fail")
        return 1

    had_error = False

    # 1. Goodreads Sync
    gr_env = load_env_file(GOODREADS_ENV_PATH)
    gr_payload: dict[str, str] = {}
    if gr_env.get("GOODREADS_USER_ID"):
        gr_payload["goodreadsUserId"] = gr_env["GOODREADS_USER_ID"]
    if gr_env.get("GOODREADS_COOKIE"):
        gr_payload["cookie"] = gr_env["GOODREADS_COOKIE"]

    try:
        code, body = post_sync("/api/v1/library/goodreads-sync", gr_payload, sync_secret)
        if code == 200:
            print(
                f"[{ts}] Goodreads sync complete: "
                f"processed={body.get('recordsProcessed', 0)} "
                f"created={body.get('createdSaves', 0)} "
                f"updated={body.get('updatedSaves', 0)}"
            )
        elif code == 400 and (
            body.get("code") == "GOODREADS_COOKIE_REQUIRED"
            or "Valid numeric Goodreads User ID" in str(body.get("error", ""))
        ):
            print(f"[{ts}] Goodreads not configured yet; skipping.")
        else:
            print(
                f"[{ts}] Goodreads sync HTTP {code}: {body.get('error', 'unknown error')}",
                file=sys.stderr,
            )
            had_error = True
    except Exception as err:
        print(f"[{ts}] Goodreads sync error: {err}", file=sys.stderr)
        had_error = True

    # 2. Letterboxd Sync
    lb_env = load_env_file(LETTERBOXD_ENV_PATH)
    lb_payload: dict[str, str] = {}
    if lb_env.get("LETTERBOXD_USERNAME"):
        lb_payload["username"] = lb_env["LETTERBOXD_USERNAME"]

    try:
        code, body = post_sync("/api/v1/cinema/letterboxd-sync", lb_payload, sync_secret)
        if code == 200:
            if body.get("skipped"):
                print(f"[{ts}] Letterboxd not configured yet; skipping.")
            else:
                print(
                    f"[{ts}] Letterboxd sync complete: "
                    f"processed={body.get('recordsProcessed', 0)} "
                    f"created={body.get('createdSaves', 0)} "
                    f"updated={body.get('updatedSaves', 0)}"
                )
        else:
            print(
                f"[{ts}] Letterboxd sync HTTP {code}: {body.get('error', 'unknown error')}",
                file=sys.stderr,
            )
            had_error = True
    except Exception as err:
        print(f"[{ts}] Letterboxd sync error: {err}", file=sys.stderr)
        had_error = True

    if had_error:
        emit_heartbeat("fail")
        return 1

    emit_heartbeat("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
