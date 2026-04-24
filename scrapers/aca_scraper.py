from bs4 import BeautifulSoup

from .base import BaseScraper, make_id, logger


class ACAScraper(BaseScraper):
    """Scrapes Artist Communities Alliance residency directory."""

    SOURCE = "aca"
    BASE = "https://www.artistcommunities.org"

    def scrape(self) -> list[dict]:
        cfg = self.config["sources"]["aca"]
        delay = cfg["request_delay_sec"]

        all_results = []
        page = 0
        max_pages = 30

        while page < max_pages:
            url = f"{self.BASE}/directory/residencies?page={page}"
            logger.info(f"[ACA] Fetching page {page}: {url}")
            html = self.fetch_page(url, delay)
            if not html:
                break

            self.save_raw(html, self.SOURCE, f"page_{page}")
            entries = self._parse_listing_page(html)

            if not entries:
                logger.info(f"[ACA] No entries on page {page}, stopping.")
                break

            all_results.extend(entries)
            logger.info(f"[ACA] Page {page}: {len(entries)} entries (total: {len(all_results)})")

            has_next = f"page={page + 1}" in html
            if not has_next:
                break
            page += 1

        logger.info(f"[ACA] Fetching detail pages for {len(all_results)} residencies...")
        for i, entry in enumerate(all_results):
            if entry.get("detail_url"):
                detail_url = f"{self.BASE}{entry['detail_url']}"
                logger.info(f"[ACA] Detail {i+1}/{len(all_results)}: {detail_url}")
                html = self.fetch_page(detail_url, delay)
                if html:
                    self.save_raw(html, self.SOURCE, f"detail_{i}")
                    self._enrich_from_detail(entry, html)

        logger.info(f"[ACA] Scraping complete: {len(all_results)} total entries")
        return all_results

    def _parse_listing_page(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        articles = soup.select("article.node--type-residency")
        entries = []

        for article in articles:
            try:
                entry = self._parse_card(article)
                if entry:
                    entries.append(entry)
            except Exception as e:
                logger.warning(f"[ACA] Failed to parse card: {e}")

        return entries

    def _parse_card(self, article) -> dict | None:
        title_el = article.select_one("span.field--name-title")
        if not title_el:
            return None
        title = title_el.get_text(strip=True)

        link_el = article.select_one("a[href*='/directory/residencies/']")
        detail_path = link_el.get("href", "") if link_el else ""

        org_el = article.select_one(".field-pseudo-field--pseudo-group_node\\:organization-link-list .field__item")
        organization = org_el.get_text(strip=True) if org_el else ""

        location_el = article.select_one(".field-pseudo-field--pseudo-residency-region")
        location = location_el.get_text(strip=True) if location_el else ""

        desc_el = article.select_one(".field--name-field-residency-description .field__item")
        description = desc_el.get_text(strip=True) if desc_el else ""

        open_calls = []
        call_table = article.select_one("table.open-call-list")
        if call_table:
            for row in call_table.select("tr")[1:]:
                cells = row.select("td")
                if len(cells) >= 2:
                    length = cells[0].get_text(strip=True)
                    call_link = cells[1].select_one("a")
                    call_name = call_link.get_text(strip=True) if call_link else cells[1].get_text(strip=True)
                    call_url = call_link.get("href", "") if call_link else ""
                    open_calls.append({
                        "length": length,
                        "name": call_name,
                        "url": f"{self.BASE}{call_url}" if call_url else "",
                    })

        return {
            "title": title,
            "organization": organization,
            "location": location,
            "description": description,
            "detail_url": detail_path,
            "open_calls": open_calls,
            "source": self.SOURCE,
        }

    def _enrich_from_detail(self, entry: dict, html: str):
        soup = BeautifulSoup(html, "html.parser")

        for field_div in soup.select(".field"):
            label_el = field_div.select_one(".field__label")
            if not label_el:
                continue
            label = label_el.get_text(strip=True).lower()
            value_el = field_div.select_one(".field__item") or field_div.select_one(".field__items")
            if not value_el:
                continue
            value = value_el.get_text(strip=True)

            if "discipline" in label:
                entry["disciplines"] = value
            elif "application type" in label:
                entry["application_type"] = value
            elif "average" in label and "artist" in label:
                entry["cohort_size"] = value
            elif "meal" in label:
                entry["meals"] = value
            elif "workspace" in label:
                entry["workspace"] = value
            elif "housing" in label or "living" in label:
                entry["housing"] = value
            elif "accessibility" in label:
                entry["accessibility"] = value
            elif "cost" in label or "fee" in label:
                entry["application_cost"] = value
