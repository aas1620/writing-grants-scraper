from thefuzz import fuzz

from scrapers.base import logger

THRESHOLD = 92


def deduplicate(entries: list[dict]) -> list[dict]:
    if not entries:
        return entries

    kept = []
    merged_count = 0

    for entry in entries:
        key = f"{entry.get('title', '')} {entry.get('organization', '')}".strip().lower()
        is_dup = False

        for existing in kept:
            existing_key = f"{existing.get('title', '')} {existing.get('organization', '')}".strip().lower()
            score = fuzz.token_sort_ratio(key, existing_key)

            if score >= THRESHOLD:
                logger.info(
                    f"Merging duplicate (score={score}): "
                    f"'{entry['title']}' [{entry['source']}] "
                    f"≈ '{existing['title']}' [{existing['source']}]"
                )
                _merge_into(existing, entry)
                merged_count += 1
                is_dup = True
                break

        if not is_dup:
            kept.append(entry)

    logger.info(f"Deduplication: {len(entries)} → {len(kept)} ({merged_count} merged)")
    return kept


def _merge_into(primary: dict, secondary: dict):
    """Fill empty fields in primary from secondary."""
    for key in primary:
        if key in ("id", "source", "scraped_date"):
            continue
        primary_val = primary.get(key)
        secondary_val = secondary.get(key)
        if (not primary_val or primary_val in ("", None)) and secondary_val:
            primary[key] = secondary_val
