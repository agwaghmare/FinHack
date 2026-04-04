"""Learn Hub peer community — file-backed threads (demo). Risk badges from portfolio analysis."""

from __future__ import annotations

import hashlib
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.services.portfolio_service import analyze_portfolio

_LOCK = threading.Lock()
_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "learn_community.json"
_MAX_POSTS = 120


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _author_label(user_id: str) -> str:
    """Stable anonymous label — avoids showing raw Clerk id fragments like …6iEjVH."""
    n = int(hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:8], 16) % 9000 + 1000
    return f"Peer {n}"


def _badge_for_risk(risk_score: float, has_positions: bool) -> str:
    """Lower scores = calmer book — helpers; higher = seekers; no holdings = newcomer."""
    if not has_positions:
        return "newcomer"
    if risk_score <= 4.0:
        return "helper"
    if risk_score < 6.0:
        return "peer"
    return "seeker"


def _load() -> dict[str, Any]:
    if not _DATA_PATH.exists():
        return {"posts": []}
    try:
        with open(_DATA_PATH, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "posts" not in data:
            return {"posts": []}
        return data
    except (json.JSONDecodeError, OSError):
        return {"posts": []}


def _save(data: dict[str, Any]) -> None:
    _DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _DATA_PATH.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    tmp.replace(_DATA_PATH)


def risk_preview(user_id: str) -> dict[str, Any]:
    r = analyze_portfolio(user_id)
    positions = r.get("positions") or []
    has_positions = isinstance(positions, list) and len(positions) > 0
    score = float(r.get("risk_score") or 0)
    return {
        "risk_score": score,
        "risk_label": r.get("risk_label") or "—",
        "badge": _badge_for_risk(score, has_positions),
        "message": r.get("message"),
        "has_positions": has_positions,
    }


def list_posts() -> dict[str, Any]:
    with _LOCK:
        data = _load()
    posts = data.get("posts") or []
    # Newest first; refresh author_short from user_id so labels stay readable
    out: list[dict[str, Any]] = []
    for p in sorted(posts, key=lambda x: x.get("created_at") or "", reverse=True):
        row = dict(p)
        uid = row.get("user_id")
        if isinstance(uid, str) and uid:
            row["author_short"] = _author_label(uid)
        rels = []
        for r in row.get("replies") or []:
            rr = dict(r)
            ru = rr.get("user_id")
            if isinstance(ru, str) and ru:
                rr["author_short"] = _author_label(ru)
            rels.append(rr)
        row["replies"] = rels
        out.append(row)
    return {"posts": out}


def create_post(user_id: str, title: str, body: str) -> dict[str, Any]:
    title = (title or "").strip()
    body = (body or "").strip()
    if len(title) < 3 or len(title) > 200:
        return {"error": "invalid_title", "detail": "Title must be 3–200 characters."}
    if len(body) < 10 or len(body) > 5000:
        return {"error": "invalid_body", "detail": "Post must be 10–5000 characters."}

    r = analyze_portfolio(user_id)
    positions = r.get("positions") or []
    has_positions = isinstance(positions, list) and len(positions) > 0
    score = float(r.get("risk_score") or 0)
    post = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "author_short": _author_label(user_id),
        "risk_score": score,
        "risk_label": r.get("risk_label") or "—",
        "badge": _badge_for_risk(score, has_positions),
        "title": title,
        "body": body,
        "created_at": _now_iso(),
        "replies": [],
    }
    with _LOCK:
        data = _load()
        posts = data.get("posts") or []
        posts.append(post)
        if len(posts) > _MAX_POSTS:
            posts = sorted(posts, key=lambda p: p.get("created_at") or "", reverse=True)[:_MAX_POSTS]
        data["posts"] = posts
        _save(data)
    return {"ok": True, "post": post}


def add_reply(post_id: str, user_id: str, body: str) -> dict[str, Any]:
    body = (body or "").strip()
    if len(body) < 5 or len(body) > 2000:
        return {"error": "invalid_body", "detail": "Reply must be 5–2000 characters."}

    r = analyze_portfolio(user_id)
    positions = r.get("positions") or []
    has_positions = isinstance(positions, list) and len(positions) > 0
    score = float(r.get("risk_score") or 0)
    reply = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "author_short": _author_label(user_id),
        "risk_score": score,
        "risk_label": r.get("risk_label") or "—",
        "badge": _badge_for_risk(score, has_positions),
        "body": body,
        "created_at": _now_iso(),
    }

    with _LOCK:
        data = _load()
        posts = data.get("posts") or []
        found = False
        for p in posts:
            if p.get("id") == post_id:
                rel = p.get("replies") or []
                rel.append(reply)
                p["replies"] = rel
                found = True
                break
        if not found:
            return {"error": "not_found", "post_id": post_id}
        _save(data)
    return {"ok": True, "reply": reply}
