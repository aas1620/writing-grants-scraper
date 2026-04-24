from bs4 import BeautifulSoup

from .base import BaseScraper, make_id, logger


class PWScraper(BaseScraper):
    """Scrapes Poets & Writers writing contests database."""

    SOURCE = "pw"

    def scrape(self) -> list[dict]:
        cfg = self.config["sources"]["pw"]
        base_url = cfg["base_url"]
        delay = cfg["request_delay_sec"]
        per_page = cfg.get("items_per_page", 100)

        all_results = []
        page = 0

        while True:
            url = (
                f"{base_url}?field_deadline_value=2"
                f"&field_entry_fee_value=All"
                f"&field_genre_target_id=All"
                f"&items_per_page={per_page}"
                f"&page={page}"
            )
            logger.info(f"[PW] Fetching page {page}: {url}")
            html = self.fetch_page(url, delay)
            if not html:
                break

            self.save_raw(html, self.SOURCE, f"page_{page}")
            entries = self._parse_page(html)

            if not entries:
                logger.info(f"[PW] No entries on page {page}, stopping.")
                break

            all_results.extend(entries)
            logger.info(f"[PW] Page {page}: {len(entries)} entries (total: {len(all_results)})")

            if len(entries) < per_page:
                break
            page += 1

        logger.info(f"[PW] Scraping complete: {len(all_results)} total entries")
        return all_results

    def _parse_page(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        rows = soup.select("div.views-row")
        entries = []

        for row in rows:
            try:
                entry = self._parse_row(row)
                if entry:
                    entries.append(entry)
            except Exception as e:
                logger.warning(f"[PW] Failed to parse row: {e}")

        return entries

    def _parse_row(self, row) -> dict | None:
        sponsor_el = row.select_one(".views-field-field-award-issuer .field-content")
        sponsor = sponsor_el.get_text(strip=True) if sponsor_el else ""

        title_el = row.select_one(".views-field-title a")
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        detail_path = title_el.get("href", "")
        detail_url = f"https://www.pw.org{detail_path}" if detail_path else ""

        cash_el = row.select_one(".views-field-field-cash-prize .field-content")
        cash_prize = cash_el.get_text(strip=True) if cash_el else ""

        fee_el = row.select_one(".views-field-field-entry-amount-int .field-content")
        entry_fee = fee_el.get_text(strip=True) if fee_el else ""

        deadline_el = row.select_one(".views-field-field-deadline .field-content")
        deadline = deadline_el.get_text(strip=True) if deadline_el else ""

        genre_el = row.select_one(".views-field-taxonomy-vocabulary-3 .field-content")
        genres = genre_el.get_text(strip=True) if genre_el else ""

        desc_el = row.select_one(".views-field-body .field-content")
        description = desc_el.get_text(strip=True) if desc_el else ""
        if description.endswith("read more"):
            description = description[:-9].strip()

        return {
            "title": title,
            "organization": sponsor,
            "cash_prize": cash_prize,
            "entry_fee": entry_fee,
            "deadline": deadline,
            "genres": genres,
            "description": description,
            "detail_url": detail_url,
            "source": self.SOURCE,
        }
