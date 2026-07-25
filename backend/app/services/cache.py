from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any


def read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def is_fresh(payload: dict[str, Any] | None, ttl_seconds: int) -> bool:
    if not payload:
        return False
    ts = payload.get("updated_at")
    if not ts:
        return False
    return (time.time() - float(ts)) < ttl_seconds


def now_payload(data: dict[str, Any]) -> dict[str, Any]:
    return {**data, "updated_at": time.time(), "updated_at_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
