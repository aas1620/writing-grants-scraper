import re
from datetime import date, datetime

from dateutil import parser as dateparser

from scrapers.base import make_id, logger


UNIFIED_FIELDS = [
    "id", "title", "organization", "opportunity_type", "writing_types",
    "award_amount", "award_amount_numeric", "entry_fee", "entry_fee_numeric",
    "deadline", "deadline_date", "deadline_expired", "geography",
    "eligibility_notes", "description", "url", "source", "scraped_date",
]


def normalize_all(raw_entries: list[dict]) -> list[dict]:
    normalized = []
    for entry in raw_entries:
        source = entry.get("source", "")
        try:
            if source == "pw":
                n = _normalize_pw(entry)
            elif source == "reedsy":
                n = _normalize_reedsy(entry)
            elif source == "aca":
                n = _normalize_aca(entry)
            elif source == "ffw":
                n = _normalize_ffw(entry)
            else:
                continue
            normalized.append(n)
        except Exception as e:
            logger.warning(f"Failed to normalize entry '{entry.get('title', '?')}': {e}")
    return normalized


def _parse_amount(text: str) -> float | None:
    if not text:
        return None
    match = re.search(r'\$?([\d,]+(?:\.\d{2})?)', text.replace(",", "").replace(" ", ""))
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            pass
    return None


def _parse_date(text: str) -> date | None:
    if not text:
        return None
    text = re.sub(r'\(Expired\)', '', text, flags=re.IGNORECASE).strip()
    if text.lower() in ("rolling", "ongoing", "none", "n/a", "tbd"):
        return None
    try:
        return dateparser.parse(text, dayfirst=False).date()
    except (ValueError, TypeError):
        return None


def _classify_type(title: str, description: str, source: str) -> str:
    combined = f"{title} {description}".lower()
    if source == "aca":
        return "residency"
    if "residency" in combined or "residencies" in combined:
        return "residency"
    if "fellowship" in combined:
        return "fellowship"
    if "grant" in combined and "contest" not in combined:
        return "grant"
    return "contest"


def _normalize_pw(entry: dict) -> dict:
    title = entry.get("title", "")
    url = entry.get("detail_url", "")
    return {
        "id": make_id("pw", title, url),
        "title": title,
        "organization": entry.get("organization", ""),
        "opportunity_type": _classify_type(title, entry.get("description", ""), "pw"),
        "writing_types": entry.get("genres", ""),
        "award_amount": entry.get("cash_prize", ""),
        "award_amount_numeric": _parse_amount(entry.get("cash_prize", "")),
        "entry_fee": entry.get("entry_fee", ""),
        "entry_fee_numeric": _parse_amount(entry.get("entry_fee", "")),
        "deadline": entry.get("deadline", ""),
        "deadline_date": _parse_date(entry.get("deadline", "")),
        "deadline_expired": _is_expired(entry.get("deadline", "")),
        "geography": "",
        "eligibility_notes": "",
        "description": entry.get("description", ""),
        "url": url,
        "source": "pw",
        "scraped_date": date.today().isoformat(),
    }


def _normalize_reedsy(entry: dict) -> dict:
    title = entry.get("title", "")
    url = entry.get("detail_url", "")
    return {
        "id": make_id("reedsy", title, url),
        "title": title,
        "organization": entry.get("organization", ""),
        "opportunity_type": _classify_type(title, entry.get("description", ""), "reedsy"),
        "writing_types": entry.get("genres", ""),
        "award_amount": entry.get("top_prize", ""),
        "award_amount_numeric": _parse_amount(entry.get("top_prize", "")),
        "entry_fee": entry.get("entry_fee", ""),
        "entry_fee_numeric": _parse_amount(entry.get("entry_fee", "")),
        "deadline": entry.get("deadline", ""),
        "deadline_date": _parse_date(entry.get("deadline", "")),
        "deadline_expired": entry.get("deadline_expired", False),
        "geography": "",
        "eligibility_notes": "",
        "description": entry.get("description", ""),
        "url": url,
        "source": "reedsy",
        "scraped_date": date.today().isoformat(),
    }


def _normalize_aca(entry: dict) -> dict:
    title = entry.get("title", "")
    detail_path = entry.get("detail_url", "")
    url = f"https://www.artistcommunities.org{detail_path}" if detail_path else ""

    open_calls = entry.get("open_calls", [])
    deadline_parts = []
    length_parts = []
    for call in open_calls:
        if call.get("name"):
            deadline_parts.append(call["name"])
        if call.get("length"):
            length_parts.append(call["length"])

    eligibility_parts = []
    if entry.get("disciplines"):
        eligibility_parts.append(f"Disciplines: {entry['disciplines']}")
    if entry.get("application_type"):
        eligibility_parts.append(f"Application: {entry['application_type']}")
    if entry.get("cohort_size"):
        eligibility_parts.append(f"Cohort size: {entry['cohort_size']}")

    desc_parts = [entry.get("description", "")]
    if entry.get("meals"):
        desc_parts.append(f"Meals: {entry['meals']}")
    if entry.get("workspace"):
        desc_parts.append(f"Workspace: {entry['workspace']}")
    if entry.get("housing"):
        desc_parts.append(f"Housing: {entry['housing']}")
    if length_parts:
        desc_parts.append(f"Length: {'; '.join(length_parts)}")

    return {
        "id": make_id("aca", title, url),
        "title": title,
        "organization": entry.get("organization", ""),
        "opportunity_type": "residency",
        "writing_types": entry.get("disciplines", ""),
        "award_amount": "",
        "award_amount_numeric": None,
        "entry_fee": entry.get("application_cost", ""),
        "entry_fee_numeric": _parse_amount(entry.get("application_cost", "")),
        "deadline": "; ".join(deadline_parts) if deadline_parts else "",
        "deadline_date": None,
        "deadline_expired": False,
        "geography": entry.get("location", ""),
        "eligibility_notes": "; ".join(eligibility_parts),
        "description": " | ".join(p for p in desc_parts if p),
        "url": url,
        "source": "aca",
        "scraped_date": date.today().isoformat(),
    }


def _normalize_ffw(entry: dict) -> dict:
    title = entry.get("title", "")
    url = entry.get("detail_url", "")
    return {
        "id": make_id("ffw", title, url),
        "title": title,
        "organization": entry.get("organization", ""),
        "opportunity_type": _classify_type(title, entry.get("description", ""), "ffw"),
        "writing_types": "",
        "award_amount": entry.get("award_amount", ""),
        "award_amount_numeric": _parse_amount(entry.get("award_amount", "")),
        "entry_fee": entry.get("entry_fee", ""),
        "entry_fee_numeric": _parse_amount(entry.get("entry_fee", "")),
        "deadline": entry.get("deadline", ""),
        "deadline_date": _parse_date(entry.get("deadline", "")),
        "deadline_expired": _is_expired(entry.get("deadline", "")),
        "geography": entry.get("location", ""),
        "eligibility_notes": "",
        "description": entry.get("description", ""),
        "url": url,
        "source": "ffw",
        "scraped_date": date.today().isoformat(),
    }


def _is_expired(deadline_str: str) -> bool:
    d = _parse_date(deadline_str)
    if d is None:
        return False
    return d < date.today()
