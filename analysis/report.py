"""Generate human-readable analysis report from dimension discovery."""

from pathlib import Path

from scrapers.base import logger


def generate_report(results: dict, output_path: str):
    lines = []
    lines.append("# Writing Opportunities: Dimension Discovery Report\n")

    summary = results["summary"]
    lines.append("## Summary\n")
    lines.append(f"- **Total opportunities:** {summary['total']}")
    for source, count in summary.get("by_source", {}).items():
        lines.append(f"  - {source}: {count}")
    lines.append(f"- **With deadlines:** {summary.get('with_deadline', 0)}")
    lines.append(f"- **Expired:** {summary.get('expired', 0)}")
    lines.append("")

    types = results.get("type_distribution", {})
    if types:
        lines.append("## Opportunity Types\n")
        for t, count in types.items():
            pct = round(100 * count / summary["total"], 1)
            bar = "█" * int(pct / 2)
            lines.append(f"- **{t}**: {count} ({pct}%) {bar}")
        lines.append("")

    genres = results.get("genre_distribution", {})
    if genres:
        lines.append("## Genre Distribution (Top 15)\n")
        for genre, count in list(genres.items())[:15]:
            pct = round(100 * count / summary["total"], 1)
            bar = "█" * int(pct / 2)
            lines.append(f"- **{genre}**: {count} ({pct}%) {bar}")
        lines.append("")

    amounts = results.get("amount_distribution", {})
    if amounts:
        lines.append("## Award Amount Distribution\n")
        for bucket, count in amounts.items():
            lines.append(f"- {bucket}: {count}")
        lines.append("")

    fees = results.get("fee_distribution", {})
    if fees:
        lines.append("## Entry Fee Distribution\n")
        for bucket, count in fees.items():
            lines.append(f"- {bucket}: {count}")
        lines.append("")

    calendar = results.get("deadline_calendar", {})
    if calendar:
        lines.append("## Deadline Calendar\n")
        max_count = max(calendar.values()) if calendar else 1
        for month, count in calendar.items():
            bar = "█" * int(20 * count / max_count)
            lines.append(f"- {month:>12}: {bar} {count}")
        lines.append("")

    for section_key, section_title in [
        ("career_stage", "Career Stage Dimensions"),
        ("demographics", "Demographic Dimensions"),
        ("geography", "Geographic Dimensions"),
        ("publication_req", "Publication Requirements"),
        ("affiliation", "Affiliation Dimensions"),
    ]:
        dims = results.get(section_key, {})
        if dims:
            lines.append(f"## {section_title}\n")
            for name, data in dims.items():
                lines.append(f"- **{name}**: {data['count']} opportunities ({data['pct']}%)")
            lines.append("")

    recs = results.get("recommended_survey_dimensions", [])
    if recs:
        lines.append("## Recommended Survey Questions\n")
        for i, rec in enumerate(recs, 1):
            lines.append(f"### Q{i}: {rec['question']}")
            lines.append(f"- **Type:** {rec['type']}")
            lines.append(f"- **Options:** {', '.join(str(o) for o in rec['options'])}")
            lines.append(f"- **Rationale:** {rec['rationale']}")
            lines.append("")

    report = "\n".join(lines)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(report)
    logger.info(f"Report written to {output_path}")
    return report
