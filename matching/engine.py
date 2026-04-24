"""Weighted scoring engine for matching opportunities to writer profiles."""

import math
import re
from datetime import date, timedelta

import pandas as pd
from dateutil import parser as dateparser

from .filters import apply_hard_filters, _parse_list, _has_overlap


def _s(val) -> str:
    """Safely convert to string, handling NaN."""
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return ""
    return str(val)


WEIGHTS = {
    "genre": 30,
    "career_stage": 20,
    "publication": 15,
    "geography": 15,
    "demographics": 15,
    "award_amount": 10,
    "entry_fee": 10,
    "deadline_proximity": 10,
    "type_preference": 10,
    "residency_fit": 10,
}


def score_all(opportunities: list[dict], profile: dict) -> tuple[list[dict], list[dict]]:
    scored = []
    excluded = []

    for opp in opportunities:
        passes, reason = apply_hard_filters(opp, profile)
        if not passes:
            excluded.append({**opp, "exclusion_reason": reason})
            continue

        result = score_opportunity(opp, profile)
        scored.append(result)

    scored.sort(key=lambda x: x["total_score"], reverse=True)
    return scored, excluded


def score_opportunity(opp: dict, profile: dict) -> dict:
    scores = {}
    notes = []

    scores["genre"] = _score_genre(opp, profile, notes)
    scores["career_stage"] = _score_career_stage(opp, profile, notes)
    scores["publication"] = _score_publication(opp, profile, notes)
    scores["geography"] = _score_geography(opp, profile, notes)
    scores["demographics"] = _score_demographics(opp, profile, notes)
    scores["award_amount"] = _score_amount(opp, profile, notes)
    scores["entry_fee"] = _score_fee(opp, profile, notes)
    scores["deadline_proximity"] = _score_deadline(opp, notes)
    scores["type_preference"] = _score_type_pref(opp, profile, notes)
    scores["residency_fit"] = _score_residency(opp, profile, notes)

    total = sum(scores.values())

    return {
        **opp,
        "total_score": total,
        "dimension_scores": scores,
        "match_notes": "; ".join(notes[:5]),
    }


def _score_genre(opp: dict, profile: dict, notes: list) -> int:
    opp_genres = _parse_list(_s(opp.get("writing_types", "")))
    profile_genres = _parse_list(profile.get("writing_genres", ""))

    if not opp_genres:
        notes.append("No genre specified (open to all)")
        return 15

    if not profile_genres:
        return 15

    if _has_overlap(opp_genres, profile_genres):
        primary = profile_genres[0] if profile_genres else ""
        if any(primary in g or g in primary for g in opp_genres):
            notes.append(f"Strong genre match ({primary})")
            return 30
        notes.append("Partial genre match")
        return 15

    return 0


def _score_career_stage(opp: dict, profile: dict, notes: list) -> int:
    text = f"{_s(opp.get('description', ''))} {_s(opp.get('eligibility_notes', ''))}".lower()
    stage = profile.get("career_stage", "").lower()

    if not stage:
        return 10

    if stage in text:
        notes.append(f"Targets {stage} writers")
        return 20

    stage_keywords = ["emerging", "early-career", "established", "mid-career", "debut"]
    if not any(kw in text for kw in stage_keywords):
        return 10

    return 5


def _score_publication(opp: dict, profile: dict, notes: list) -> int:
    text = f"{_s(opp.get('description', ''))} {_s(opp.get('eligibility_notes', ''))}".lower()
    history = profile.get("publication_history", "").lower()

    if not history:
        return 10

    if "unpublished" in text and "unpublished" in history:
        notes.append("Welcomes unpublished writers")
        return 15
    if "first book" in text and history in ("unpublished", "published in magazines"):
        notes.append("For debut/first book authors")
        return 15
    if "published" in text and "unpublished" not in text and "published" in history:
        return 15

    pub_keywords = ["published", "unpublished", "first book", "debut"]
    if not any(kw in text for kw in pub_keywords):
        return 10

    return 5


def _score_geography(opp: dict, profile: dict, notes: list) -> int:
    geo = _s(opp.get("geography", "")).lower()
    text = f"{_s(opp.get('description', ''))} {_s(opp.get('eligibility_notes', ''))}".lower()
    combined = f"{geo} {text}"

    state = profile.get("state_of_residence", "").lower()
    us_citizen = profile.get("us_citizen", True)

    if not geo and "resident of" not in text and "citizen" not in text:
        return 10

    if "international" in combined or "worldwide" in combined:
        notes.append("Open internationally")
        return 15

    if "u.s." in combined or "united states" in combined or "american" in combined:
        if us_citizen:
            notes.append("US residents eligible")
            return 15
        return 3

    if state and state in combined:
        notes.append(f"Available in {state}")
        return 15

    return 5


def _score_demographics(opp: dict, profile: dict, notes: list) -> int:
    text = f"{_s(opp.get('description', ''))} {_s(opp.get('eligibility_notes', ''))}".lower()
    demo = _parse_list(profile.get("demographics", ""))

    if not demo:
        return 5

    for d in demo:
        if d.lower() in text:
            notes.append(f"Supports {d} writers")
            return 15

    return 5


def _score_amount(opp: dict, profile: dict, notes: list) -> int:
    amount = opp.get("award_amount_numeric")
    minimum = profile.get("min_award_amount")

    if amount is None:
        return 5

    if minimum is not None:
        if amount >= float(minimum):
            if amount >= 5000:
                notes.append(f"Award: ${amount:,.0f}")
            return 10
        return 2

    if amount >= 1000:
        return 10
    if amount >= 500:
        return 7
    return 4


def _score_fee(opp: dict, profile: dict, notes: list) -> int:
    fee = opp.get("entry_fee_numeric")

    if fee is None:
        return 5
    if fee == 0:
        notes.append("Free to enter")
        return 10
    if fee <= 10:
        return 7
    if fee <= 20:
        return 4
    return 2


def _score_deadline(opp: dict, notes: list) -> int:
    deadline_str = opp.get("deadline_date")
    if not deadline_str or (isinstance(deadline_str, float) and math.isnan(deadline_str)):
        return 5

    try:
        if isinstance(deadline_str, str):
            deadline = dateparser.parse(deadline_str).date()
        elif isinstance(deadline_str, date):
            deadline = deadline_str
        else:
            return 5
    except (ValueError, TypeError):
        return 5

    today = date.today()
    days_out = (deadline - today).days

    if days_out < 0:
        return 0
    if days_out > 60:
        notes.append(f"Deadline in {days_out} days")
        return 10
    if days_out > 30:
        return 7
    if days_out > 14:
        notes.append(f"Deadline in {days_out} days — apply soon")
        return 5
    notes.append(f"Deadline in {days_out} days — urgent")
    return 3


def _score_type_pref(opp: dict, profile: dict, notes: list) -> int:
    prefs = _parse_list(profile.get("interested_types", ""))
    opp_type = opp.get("opportunity_type", "").lower()

    if not prefs or not opp_type:
        return 5

    if opp_type == prefs[0].lower():
        return 10
    if opp_type in [p.lower() for p in prefs]:
        return 5
    return 2


def _score_residency(opp: dict, profile: dict, notes: list) -> int:
    if opp.get("opportunity_type", "").lower() != "residency":
        return 0

    interested = profile.get("interested_in_residencies", True)
    if not interested:
        return 0

    max_weeks = profile.get("max_residency_weeks")
    desc = _s(opp.get("description", "")).lower()

    if max_weeks:
        week_match = re.search(r'(\d+)\s*week', desc)
        if week_match:
            opp_weeks = int(week_match.group(1))
            if opp_weeks <= int(max_weeks):
                notes.append(f"{opp_weeks}-week residency fits your availability")
                return 10
            return 3

    notes.append("Residency opportunity")
    return 7
