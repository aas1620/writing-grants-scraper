#!/usr/bin/env python3
"""CLI entry point for scraping writing grants, fellowships, and residencies."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from scrapers.base import load_config, logger
from scrapers.pw_scraper import PWScraper
from scrapers.reedsy_scraper import ReedsyScraper
from scrapers.aca_scraper import ACAScraper
from scrapers.ffw_scraper import FFWScraper
from pipeline.normalize import normalize_all
from pipeline.deduplicate import deduplicate
from pipeline.export import export


SCRAPERS = {
    "pw": PWScraper,
    "reedsy": ReedsyScraper,
    "aca": ACAScraper,
    "ffw": FFWScraper,
}


def main():
    parser = argparse.ArgumentParser(description="Scrape writing grants and opportunities")
    parser.add_argument("--source", choices=list(SCRAPERS.keys()), help="Scrape only this source")
    parser.add_argument("--skip-normalize", action="store_true", help="Skip normalization")
    parser.add_argument("--no-dedup", action="store_true", help="Skip deduplication")
    args = parser.parse_args()

    config = load_config()

    sources = [args.source] if args.source else [
        name for name, cfg in config["sources"].items()
        if cfg.get("enabled", True) and name in SCRAPERS
    ]

    all_raw = []
    for source_name in sources:
        scraper_cls = SCRAPERS[source_name]
        scraper = scraper_cls(config)
        logger.info(f"Starting scrape: {source_name}")
        try:
            results = scraper.scrape()
            all_raw.extend(results)
            logger.info(f"{source_name}: {len(results)} entries")
        except Exception as e:
            logger.error(f"{source_name} failed: {e}")

    logger.info(f"Total raw entries: {len(all_raw)}")

    if args.skip_normalize:
        logger.info("Skipping normalization (--skip-normalize)")
        return

    normalized = normalize_all(all_raw)
    logger.info(f"Normalized: {len(normalized)} entries")

    if not args.no_dedup:
        normalized = deduplicate(normalized)

    output = config.get("output", {})
    csv_path = output.get("master_csv", "data/opportunities.csv")
    xlsx_path = output.get("master_xlsx", "data/opportunities.xlsx")
    export(normalized, csv_path, xlsx_path)

    source_counts = {}
    for entry in normalized:
        s = entry.get("source", "unknown")
        source_counts[s] = source_counts.get(s, 0) + 1

    logger.info("=== SUMMARY ===")
    for s, count in sorted(source_counts.items()):
        logger.info(f"  {s}: {count}")
    logger.info(f"  TOTAL: {len(normalized)}")


if __name__ == "__main__":
    main()
