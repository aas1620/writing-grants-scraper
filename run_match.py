#!/usr/bin/env python3
"""CLI entry point for matching opportunities to a writer profile."""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from matching.engine import score_all
from matching.export_ranked import export_ranked
from scrapers.base import logger


def main():
    parser = argparse.ArgumentParser(description="Match opportunities to writer profile")
    parser.add_argument("--profile", required=True, help="Path to writer_profile.json")
    parser.add_argument("--csv", default="data/opportunities.csv", help="Path to opportunities CSV")
    parser.add_argument("--output", default="data/matched_results.xlsx", help="Output Excel path")
    parser.add_argument("--min-score", type=int, default=0, help="Minimum score to include")
    parser.add_argument("--type", help="Filter to specific opportunity type")
    args = parser.parse_args()

    if not Path(args.profile).exists():
        logger.error(f"Profile not found: {args.profile}")
        sys.exit(1)
    if not Path(args.csv).exists():
        logger.error(f"CSV not found: {args.csv}. Run run_scrape.py first.")
        sys.exit(1)

    with open(args.profile) as f:
        profile = json.load(f)

    df = pd.read_csv(args.csv)
    opportunities = df.to_dict("records")
    logger.info(f"Loaded {len(opportunities)} opportunities and profile for {profile.get('writer_name', 'Unknown')}")

    if args.type:
        opportunities = [o for o in opportunities if o.get("opportunity_type", "").lower() == args.type.lower()]
        logger.info(f"Filtered to {len(opportunities)} {args.type} opportunities")

    scored, excluded = score_all(opportunities, profile)

    if args.min_score:
        scored = [s for s in scored if s["total_score"] >= args.min_score]

    export_ranked(scored, excluded, args.output)

    logger.info("=== TOP 10 MATCHES ===")
    for s in scored[:10]:
        logger.info(
            f"  [{s['total_score']:3d}] {s['title']} — {s['organization']} "
            f"({s.get('opportunity_type', '')}) | {s.get('match_notes', '')}"
        )


if __name__ == "__main__":
    main()
