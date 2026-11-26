#!/usr/bin/env python3
"""
Host LaunchAgent script for daily incremental Instagram Saves sync into Curio.
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
        with urllib.request.urlopen(req, timeout=300) as resp:
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

    ig_env = load_env_file(INSTAGRAM_ENV_PATH)
    payload: dict = {"incremental": True, "maxPages": 5, "force": True}
    if ig_env.get("INSTAGRAM_COOKIE"):
        payload["cookie"] = ig_env["INSTAGRAM_COOKIE"]
    if ig_env.get("INSTAGRAM_USERNAME"):
        payload["igUsername"] = ig_env["INSTAGRAM_USERNAME"]

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
