#!/usr/bin/env python3
"""CLI entry point for analyzing scraped writing opportunities."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from analysis.dimension_discovery import discover_dimensions
from analysis.report import generate_report
from scrapers.base import logger


def main():
    parser = argparse.ArgumentParser(description="Analyze scraped writing opportunities")
    parser.add_argument("--csv", default="data/opportunities.csv", help="Path to opportunities CSV")
    parser.add_argument("--output", default="data/analysis_report.md", help="Output report path")
    parser.add_argument("--dimensions-only", action="store_true", help="Print discovered dimensions only")
    parser.add_argument("--suggest-survey", action="store_true", help="Output suggested survey questions")
    args = parser.parse_args()

    if not Path(args.csv).exists():
        logger.error(f"CSV not found: {args.csv}. Run run_scrape.py first.")
        sys.exit(1)

    results = discover_dimensions(args.csv)

    if args.dimensions_only:
        for section in ["career_stage", "demographics", "geography", "publication_req", "affiliation"]:
            dims = results.get(section, {})
            if dims:
                print(f"\n{section.upper()}:")
                for name, data in dims.items():
                    print(f"  {name}: {data['count']} ({data['pct']}%)")
        return

    if args.suggest_survey:
        recs = results.get("recommended_survey_dimensions", [])
        print(json.dumps(recs, indent=2))
        schema_path = Path("survey/profile_schema.json")
        schema_path.parent.mkdir(parents=True, exist_ok=True)
        schema_path.write_text(json.dumps(recs, indent=2))
        logger.info(f"Survey schema written to {schema_path}")
        return

    report = generate_report(results, args.output)
    print(report)


if __name__ == "__main__":
    main()
