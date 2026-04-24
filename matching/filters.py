"""Hard filters that produce binary include/exclude decisions."""


def apply_hard_filters(opportunity: dict, profile: dict) -> tuple[bool, str]:
    """Returns (passes, reason). If passes is False, reason explains why."""

    if opportunity.get("deadline_expired", False):
        return False, "Deadline expired"

    opp_genres = _parse_list(opportunity.get("writing_types", ""))
    profile_genres = _parse_list(profile.get("writing_genres", ""))
    if opp_genres and profile_genres:
        if not _has_overlap(opp_genres, profile_genres):
            desc = str(opportunity.get("description", "")).lower()
            writing_keywords = ["writer", "writing", "literary", "fiction", "poet", "author", "manuscript"]
            if not any(kw in desc for kw in writing_keywords):
                return False, f"Genre mismatch: {', '.join(opp_genres)} vs your {', '.join(profile_genres)}"

    interested_types = _parse_list(profile.get("interested_types", ""))
    opp_type = opportunity.get("opportunity_type", "").lower()
    if interested_types and opp_type:
        if opp_type not in [t.lower() for t in interested_types]:
            return False, f"Type '{opp_type}' not in your preferences"

    max_fee = profile.get("max_entry_fee")
    if max_fee is not None:
        opp_fee = opportunity.get("entry_fee_numeric")
        if opp_fee is not None and opp_fee > float(max_fee):
            return False, f"Entry fee ${opp_fee:.0f} exceeds your max ${max_fee}"

    return True, "Passed all filters"


def _parse_list(val) -> list[str]:
    if isinstance(val, list):
        return [v.strip().lower() for v in val if isinstance(v, str) and v.strip()]
    if isinstance(val, float):
        return []
    if isinstance(val, str):
        items = []
        for item in val.replace(";", ",").replace("/", ",").replace(" and ", ",").split(","):
            item = item.strip().lower()
            if item:
                items.append(item)
        return items
    return []


GENRE_ALIASES = {
    "literature": {"fiction", "creative nonfiction", "poetry", "novel", "short story", "essay", "memoir"},
    "literary arts": {"fiction", "creative nonfiction", "poetry", "novel", "short story", "essay", "memoir"},
    "writing": {"fiction", "creative nonfiction", "poetry", "novel", "short story", "essay", "memoir"},
    "fiction": {"fiction", "novel", "short story", "literary fiction"},
    "creative nonfiction": {"creative nonfiction", "essay", "memoir", "non-fiction"},
    "non-fiction": {"creative nonfiction", "essay", "memoir", "non-fiction"},
    "nonfiction": {"creative nonfiction", "essay", "memoir", "non-fiction"},
}


def _has_overlap(list_a: list[str], list_b: list[str]) -> bool:
    set_a = set(list_a)
    set_b = set(list_b)
    if set_a & set_b:
        return True
    for a in set_a:
        for b in set_b:
            if a in b or b in a:
                return True
    expanded_a = set()
    for a in set_a:
        expanded_a.add(a)
        expanded_a.update(GENRE_ALIASES.get(a, set()))
    expanded_b = set()
    for b in set_b:
        expanded_b.add(b)
        expanded_b.update(GENRE_ALIASES.get(b, set()))
    return bool(expanded_a & expanded_b)
