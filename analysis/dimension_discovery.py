"""Analyze scraped opportunity data to discover matching dimensions."""

import re
from collections import Counter
from datetime import date
from pathlib import Path

import pandas as pd

from scrapers.base import logger


CAREER_STAGE_PATTERNS = {
    "emerging": r"\bemerging\b",
    "early-career": r"\bearly[- ]career\b",
    "established": r"\bestablished\b",
    "mid-career": r"\bmid[- ]career\b",
    "debut": r"\bdebut\b",
    "first book": r"\bfirst\s+book\b",
    "unpublished": r"\bunpublished\b",
    "published": r"\bpublished\b(?!\s+(?:by|in|on))",
    "student": r"\bstudent\b",
}

DEMOGRAPHIC_PATTERNS = {
    "women": r"\bwom[ae]n\b",
    "BIPOC": r"\b(?:BIPOC|Black|African American|Indigenous|Native|people of color|writers? of color)\b",
    "LGBTQ": r"\b(?:LGBTQ|queer|transgender|nonbinary)\b",
    "disabled": r"\b(?:disabled|disability|disabilities)\b",
    "immigrant": r"\b(?:immigrant|refugee|diaspora|new american)\b",
    "veteran": r"\bveteran\b",
    "youth": r"\b(?:under\s+\d{2}|young\s+writer|youth|teen)\b",
    "senior": r"\b(?:over\s+(?:40|50|60)|senior\s+writer)\b",
}

GEOGRAPHIC_PATTERNS = {
    "US citizen/resident": r"\b(?:U\.?S\.?\s+citizen|US\s+resident|American\s+citizen|United\s+States)\b",
    "international": r"\b(?:international|worldwide|global|any\s+country)\b",
    "UK": r"\b(?:UK|United\s+Kingdom|British)\b",
    "Canada": r"\b(?:Canad(?:a|ian))\b",
    "state-specific": r"\bresident\s+of\b",
}

AFFILIATION_PATTERNS = {
    "MFA": r"\bMFA\b",
    "university": r"\b(?:university|academic|faculty|professor)\b",
    "member": r"\bmember\s+of\b",
}

PUBLICATION_PATTERNS = {
    "no publication required": r"\bno\s+(?:prior\s+)?publication\b",
    "published required": r"\b(?:must\s+have\s+published|published\s+(?:at\s+least|a)\s+(?:one|two|1|2)\s+book)\b",
    "chapbook": r"\bchapbook\b",
    "manuscript": r"\bmanuscript\b",
}


def discover_dimensions(csv_path: str) -> dict:
    df = pd.read_csv(csv_path)
    logger.info(f"Analyzing {len(df)} opportunities")

    results = {
        "summary": _summary_stats(df),
        "genre_distribution": _genre_distribution(df),
        "type_distribution": _type_distribution(df),
        "amount_distribution": _amount_distribution(df),
        "fee_distribution": _fee_distribution(df),
        "deadline_calendar": _deadline_calendar(df),
        "career_stage": _scan_patterns(df, CAREER_STAGE_PATTERNS, "career_stage"),
        "demographics": _scan_patterns(df, DEMOGRAPHIC_PATTERNS, "demographics"),
        "geography": _scan_patterns(df, GEOGRAPHIC_PATTERNS, "geography"),
        "affiliation": _scan_patterns(df, AFFILIATION_PATTERNS, "affiliation"),
        "publication_req": _scan_patterns(df, PUBLICATION_PATTERNS, "publication"),
        "recommended_survey_dimensions": [],
    }

    results["recommended_survey_dimensions"] = _recommend_survey(results, len(df))
    return results


def _summary_stats(df: pd.DataFrame) -> dict:
    return {
        "total": len(df),
        "by_source": df["source"].value_counts().to_dict(),
        "by_type": df["opportunity_type"].value_counts().to_dict() if "opportunity_type" in df.columns else {},
        "with_deadline": int(df["deadline_date"].notna().sum()) if "deadline_date" in df.columns else 0,
        "expired": int(df["deadline_expired"].sum()) if "deadline_expired" in df.columns else 0,
    }


def _genre_distribution(df: pd.DataFrame) -> dict:
    all_genres = Counter()
    for val in df["writing_types"].dropna():
        for genre in re.split(r'[,;/&]|\band\b', str(val)):
            genre = genre.strip().lower()
            if genre and len(genre) > 1:
                all_genres[genre] += 1
    return dict(all_genres.most_common(30))


def _type_distribution(df: pd.DataFrame) -> dict:
    if "opportunity_type" not in df.columns:
        return {}
    return df["opportunity_type"].value_counts().to_dict()


def _amount_distribution(df: pd.DataFrame) -> dict:
    if "award_amount_numeric" not in df.columns:
        return {}
    amounts = df["award_amount_numeric"].dropna()
    if amounts.empty:
        return {}
    buckets = {
        "$0 (no prize)": int((amounts == 0).sum()),
        "$1-$500": int(((amounts > 0) & (amounts <= 500)).sum()),
        "$501-$2,000": int(((amounts > 500) & (amounts <= 2000)).sum()),
        "$2,001-$10,000": int(((amounts > 2000) & (amounts <= 10000)).sum()),
        "$10,001-$50,000": int(((amounts > 10000) & (amounts <= 50000)).sum()),
        "$50,001+": int((amounts > 50000).sum()),
    }
    return {k: v for k, v in buckets.items() if v > 0}


def _fee_distribution(df: pd.DataFrame) -> dict:
    if "entry_fee_numeric" not in df.columns:
        return {}
    fees = df["entry_fee_numeric"].dropna()
    if fees.empty:
        return {}
    buckets = {
        "Free ($0)": int((fees == 0).sum()),
        "$1-$10": int(((fees > 0) & (fees <= 10)).sum()),
        "$11-$20": int(((fees > 10) & (fees <= 20)).sum()),
        "$21-$35": int(((fees > 20) & (fees <= 35)).sum()),
        "$36+": int((fees > 35).sum()),
    }
    return {k: v for k, v in buckets.items() if v > 0}


def _deadline_calendar(df: pd.DataFrame) -> dict:
    if "deadline_date" not in df.columns:
        return {}
    months = Counter()
    for val in df["deadline_date"].dropna():
        try:
            d = pd.to_datetime(val)
            months[d.strftime("%B")] += 1
        except Exception:
            pass
    month_order = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    return {m: months.get(m, 0) for m in month_order if months.get(m, 0) > 0}


def _scan_patterns(df: pd.DataFrame, patterns: dict, label: str) -> dict:
    text_cols = ["description", "eligibility_notes", "title"]
    combined = df[text_cols].fillna("").agg(" ".join, axis=1).str.lower()

    results = {}
    for name, pattern in patterns.items():
        count = int(combined.str.contains(pattern, regex=True, case=False).sum())
        if count > 0:
            pct = round(100 * count / len(df), 1)
            results[name] = {"count": count, "pct": pct}

    return dict(sorted(results.items(), key=lambda x: x[1]["count"], reverse=True))


def _recommend_survey(results: dict, total: int) -> list[dict]:
    """Recommend survey questions based on dimension frequency."""
    recommendations = []

    recommendations.append({
        "question": "What genres do you write?",
        "type": "multi-select",
        "options": list(results["genre_distribution"].keys())[:15],
        "rationale": f"Genres appear across all {total} opportunities. Primary filter.",
    })

    recommendations.append({
        "question": "What types of opportunities interest you?",
        "type": "multi-select",
        "options": list(results["type_distribution"].keys()),
        "rationale": "Filters entire categories of opportunities.",
    })

    career_dims = results.get("career_stage", {})
    if career_dims:
        recommendations.append({
            "question": "How would you describe your career stage?",
            "type": "single-select",
            "options": list(career_dims.keys()),
            "rationale": f"Career stage mentioned in {sum(d['count'] for d in career_dims.values())} opportunities.",
        })

    pub_dims = results.get("publication_req", {})
    if pub_dims:
        recommendations.append({
            "question": "What is your publication history?",
            "type": "single-select",
            "options": ["Unpublished", "Published in magazines/journals", "Published one book", "Published multiple books"],
            "rationale": f"Publication requirements found in {sum(d['count'] for d in pub_dims.values())} opportunities.",
        })

    demo_dims = results.get("demographics", {})
    if demo_dims:
        recommendations.append({
            "question": "Do any of these apply to you? (optional — some grants specifically support these groups)",
            "type": "multi-select",
            "options": list(demo_dims.keys()),
            "rationale": f"Demographics mentioned in {sum(d['count'] for d in demo_dims.values())} opportunities.",
        })

    geo_dims = results.get("geography", {})
    if geo_dims:
        recommendations.append({
            "question": "Where are you based?",
            "type": "text + select",
            "options": list(geo_dims.keys()),
            "rationale": f"Geographic requirements in {sum(d['count'] for d in geo_dims.values())} opportunities.",
        })

    amount_dist = results.get("amount_distribution", {})
    if amount_dist:
        recommendations.append({
            "question": "Minimum award amount you're interested in?",
            "type": "number",
            "options": ["$0 (any)", "$100", "$500", "$1,000", "$5,000"],
            "rationale": "Filters low-value opportunities.",
        })

    fee_dist = results.get("fee_distribution", {})
    if fee_dist:
        recommendations.append({
            "question": "Maximum entry fee you're willing to pay?",
            "type": "number",
            "options": ["$0 (free only)", "$10", "$20", "$35", "Any"],
            "rationale": "Many contests have entry fees; filters by budget.",
        })

    if results.get("type_distribution", {}).get("residency", 0) > 0:
        recommendations.append({
            "question": "If interested in residencies: max weeks you could attend?",
            "type": "number",
            "options": ["1-2 weeks", "2-4 weeks", "1-3 months", "3+ months"],
            "rationale": "Residency length varies widely.",
        })

    affil_dims = results.get("affiliation", {})
    if affil_dims:
        recommendations.append({
            "question": "Do you have an MFA or university affiliation?",
            "type": "yes/no",
            "options": ["Yes", "No"],
            "rationale": f"MFA/university mentioned in {sum(d['count'] for d in affil_dims.values())} opportunities.",
        })

    return recommendations
