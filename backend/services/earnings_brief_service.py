"""SEC filings + transcript/news cues for concise earnings key points."""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_SEC_CONTACT = (os.getenv("SEC_API_CONTACT") or "research@finhack.local").strip()
_UA = {
    "User-Agent": f"FinHack/1.0 ({_SEC_CONTACT})",
    "Accept-Encoding": "gzip, deflate",
    "Host": "www.sec.gov",
}
_SEC_FORMS = ("10-Q", "10-K", "8-K")


def _clean_text(raw: str) -> str:
    t = re.sub(r"<script[\s\S]*?</script>", " ", raw, flags=re.I)
    t = re.sub(r"<style[\s\S]*?</style>", " ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _split_sentences(text: str) -> list[str]:
    out = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    return [s for s in out if 35 <= len(s) <= 260]


def _pick_key_points(text: str, *, limit: int = 5) -> list[str]:
    if not text:
        return []
    needles = (
        "revenue",
        "eps",
        "guidance",
        "margin",
        "cash flow",
        "outlook",
        "demand",
        "capex",
        "buyback",
        "segment",
    )
    pts: list[str] = []
    seen: set[str] = set()
    for sent in _split_sentences(text):
        low = sent.lower()
        if not any(k in low for k in needles):
            continue
        norm = re.sub(r"[^a-z0-9]+", " ", low).strip()
        if norm in seen:
            continue
        seen.add(norm)
        pts.append(sent)
        if len(pts) >= limit:
            break
    return pts


@lru_cache(maxsize=1)
def _ticker_to_cik() -> dict[str, int]:
    url = "https://www.sec.gov/files/company_tickers.json"
    with httpx.Client(timeout=20.0, headers=_UA, follow_redirects=True) as c:
        r = c.get(url)
        r.raise_for_status()
        data = r.json()
    out: dict[str, int] = {}
    if isinstance(data, dict):
        for row in data.values():
            if not isinstance(row, dict):
                continue
            t = str(row.get("ticker") or "").upper().strip()
            cik = row.get("cik_str")
            if t and isinstance(cik, int):
                out[t] = cik
    return out


def _latest_sec_forms(symbol: str, *, max_items: int = 3) -> list[dict[str, str]]:
    cik = _ticker_to_cik().get(symbol.upper().strip())
    if not cik:
        return []
    cik_padded = f"{cik:010d}"
    url = f"https://data.sec.gov/submissions/CIK{cik_padded}.json"
    with httpx.Client(timeout=20.0, headers=_UA, follow_redirects=True) as c:
        r = c.get(url)
        r.raise_for_status()
        data = r.json()
    rec = (((data or {}).get("filings") or {}).get("recent") or {})
    forms = rec.get("form") or []
    acc = rec.get("accessionNumber") or []
    docs = rec.get("primaryDocument") or []
    dates = rec.get("filingDate") or []
    out: list[dict[str, str]] = []
    for i, f in enumerate(forms):
        if str(f) not in _SEC_FORMS:
            continue
        accession = str(acc[i] if i < len(acc) else "").replace("-", "")
        doc = str(docs[i] if i < len(docs) else "")
        if not accession or not doc:
            continue
        out.append(
            {
                "form": str(f),
                "filing_date": str(dates[i] if i < len(dates) else ""),
                "url": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession}/{doc}",
            }
        )
        if len(out) >= max_items:
            break
    return out


def _transcript_like_points(symbol: str, *, limit: int = 2) -> list[str]:
    try:
        import yfinance as yf  # type: ignore[import-untyped]

        t = yf.Ticker(symbol.upper().strip().replace(".", "-"))
        news = getattr(t, "news", None) or []
    except Exception as e:
        logger.debug("transcript-like fetch %s: %s", symbol, e)
        return []
    keys = ("earnings call", "transcript", "guidance", "conference call")
    out: list[str] = []
    for row in news[:12]:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()
        if not title:
            continue
        low = title.lower()
        if any(k in low for k in keys):
            out.append(title)
            if len(out) >= limit:
                break
    return out


def get_earnings_brief(symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    if not sym:
        return {"symbol": "", "error": "symbol_required", "main_points": []}
    sec_error: str | None = None
    try:
        forms = _latest_sec_forms(sym, max_items=3)
    except Exception as e:
        logger.warning("sec forms fetch failed %s: %s", sym, e)
        forms = []
        sec_error = str(e)[:180]
    filing_points: list[str] = []
    if forms:
        with httpx.Client(timeout=20.0, headers=_UA, follow_redirects=True) as c:
            for f in forms:
                try:
                    r = c.get(f["url"])
                    if r.status_code >= 400:
                        continue
                    text = _clean_text(r.text)
                    pts = _pick_key_points(text, limit=2)
                    for p in pts:
                        filing_points.append(f"{f['form']}: {p}")
                        if len(filing_points) >= 4:
                            break
                except Exception as e:
                    logger.debug("filing parse %s %s: %s", sym, f.get("url"), e)
                if len(filing_points) >= 4:
                    break

    transcript_points = _transcript_like_points(sym, limit=2)
    main_points = (filing_points + [f"Call/Transcript: {p}" for p in transcript_points])[:5]

    if not main_points:
        main_points = [
            "No parseable filing/transcript points were found right now; check back after the company files fresh reports.",
        ]

    return {
        "symbol": sym,
        "forms": forms,
        "transcript_cues": transcript_points,
        "main_points": main_points,
        "sec_error": sec_error,
    }
