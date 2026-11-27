#!/usr/bin/env python3
"""
Host LaunchAgent & manual backfill script for Instagram Saves sync into Curio.
Uses Apple-signed /usr/bin/python3 -I (stdlib only, no third-party deps).
Never logs cookie secrets.
"""

import argparse
import json
import os
import subprocess
import sys
import time
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
INSTAGRAM_ENV_PATH = Path(
    os.environ.get(
        "INSTAGRAM_ENV_PATH",
        str(Path.home() / "Utilities/secrets/instagram.env"),
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
                [str(HEARTBEAT_SCRIPT), "curio-instagram-sync", status],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
            )
        except Exception:
            pass


def post_sync(endpoint: str, payload: dict, sync_secret: str) -> tuple[int, dict]:
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
        with urllib.request.urlopen(req, timeout=600) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        raw_err = err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw_err)
        except Exception:
            parsed = {"error": raw_err[:200]}
        return err.code, parsed


def run_backfill(
    sync_secret: str,
    base_auth_payload: dict,
    max_batches: int,
    pause_seconds: float,
) -> int:
    cursor: str | None = None
    total_created = 0
    total_updated = 0
    total_archived = 0

    for batch in range(1, max_batches + 1):
        ts = datetime.now(timezone.utc).isoformat()
        payload = {
            **base_auth_payload,
            "incremental": False,
            "maxPages": 1,
            "maxNewItems": 25,
            "force": True,
        }
        if cursor:
            payload["startMaxId"] = cursor

        try:
            code, body = post_sync("/api/v1/sync/instagram", payload, sync_secret)
        except Exception as err:
            print(f"[{ts}] Backfill batch {batch} error: {err}", file=sys.stderr, flush=True)
            emit_heartbeat("fail")
            return 1

        if code == 400 and body.get("code") == "INSTAGRAM_COOKIE_REQUIRED":
            print(f"[{ts}] Instagram not configured yet; skipping.", flush=True)
            emit_heartbeat("ok")
            return 0
        if code in (401, 429):
            print(
                f"[{ts}] Instagram auth/challenge ({body.get('code')}): {body.get('error', 'refresh required')}",
                file=sys.stderr,
                flush=True,
            )
            emit_heartbeat("fail")
            return 1
        if code != 200:
            print(
                f"[{ts}] Backfill batch {batch} HTTP {code}: {body.get('error', 'unknown error')}",
                file=sys.stderr,
                flush=True,
            )
            emit_heartbeat("fail")
            return 1

        meta = body.get("meta") or {}
        created = int(body.get("createdSaves", 0) or 0)
        updated = int(body.get("updatedSaves", 0) or 0)
        archived = int(meta.get("mediaArchivedCount", 0) or 0)
        more_available = bool(meta.get("moreAvailable"))
        next_cursor = meta.get("nextMaxId")

        total_created += created
        total_updated += updated
        total_archived += archived

        print(
            f"[{ts}] Backfill batch {batch}: "
            f"processed={body.get('recordsProcessed', 0)} "
            f"created={created} "
            f"updated={updated} "
            f"archived_media={archived} "
            f"more={more_available}",
            flush=True,
        )

        if not more_available or not next_cursor or next_cursor == cursor:
            break
        cursor = str(next_cursor)
        if pause_seconds > 0:
            time.sleep(pause_seconds)

    ts = datetime.now(timezone.utc).isoformat()
    print(
        f"[{ts}] Instagram historical backfill complete: "
        f"total_created={total_created} total_updated={total_updated} total_archived={total_archived}",
        flush=True,
    )
    emit_heartbeat("ok")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Curio Instagram Saves sync & backfill runner")
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="Walk all historical saved post pages cursor-by-cursor until exhausted.",
    )
    parser.add_argument(
        "--max-batches",
        type=int,
        default=60,
        help="Maximum batches during --backfill (default: 60).",
    )
    parser.add_argument(
        "--pause",
        type=float,
        default=4.0,
        help="Seconds to pause between backfill batches (default: 4.0).",
    )
    args = parser.parse_args()

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

    ig_env = load_env_file(INSTAGRAM_ENV_PATH)
    base_auth_payload: dict = {}
    if ig_env.get("INSTAGRAM_COOKIE"):
        base_auth_payload["cookie"] = ig_env["INSTAGRAM_COOKIE"]
    if ig_env.get("INSTAGRAM_USERNAME"):
        base_auth_payload["igUsername"] = ig_env["INSTAGRAM_USERNAME"]

    if args.backfill:
        return run_backfill(
            sync_secret=sync_secret,
            base_auth_payload=base_auth_payload,
            max_batches=max(1, args.max_batches),
            pause_seconds=max(0.0, args.pause),
        )

    payload: dict = {
        **base_auth_payload,
        "incremental": True,
        "maxPages": 5,
        "maxNewItems": 15,
        "force": True,
    }

    try:
        code, body = post_sync("/api/v1/sync/instagram", payload, sync_secret)
        if code == 200:
            meta = body.get("meta") or {}
            print(
                f"[{ts}] Instagram sync complete: "
                f"processed={body.get('recordsProcessed', 0)} "
                f"created={body.get('createdSaves', 0)} "
                f"updated={body.get('updatedSaves', 0)} "
                f"archived_media={meta.get('mediaArchivedCount', 0)}"
            )
            emit_heartbeat("ok")
            return 0
        if code == 400 and body.get("code") == "INSTAGRAM_COOKIE_REQUIRED":
            print(f"[{ts}] Instagram not configured yet; skipping.")
            emit_heartbeat("ok")
            return 0
        if code in (401, 429):
            print(
                f"[{ts}] Instagram auth/challenge ({body.get('code')}): {body.get('error', 'refresh required')}",
                file=sys.stderr,
            )
            emit_heartbeat("fail")
            return 1

        print(
            f"[{ts}] Instagram sync HTTP {code}: {body.get('error', 'unknown error')}",
            file=sys.stderr,
        )
        emit_heartbeat("fail")
        return 1
    except Exception as err:
        print(f"[{ts}] Instagram sync error: {err}", file=sys.stderr)
        emit_heartbeat("fail")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
