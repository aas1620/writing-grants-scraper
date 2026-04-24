import re

from bs4 import BeautifulSoup

from .base import BaseScraper, make_id, logger


class ReedsyScraper(BaseScraper):
    """Scrapes Reedsy writing contests directory."""

    SOURCE = "reedsy"

    def scrape(self) -> list[dict]:
        cfg = self.config["sources"]["reedsy"]
        base_url = cfg["base_url"]
        delay = cfg["request_delay_sec"]

        all_results = []
        page = 1
        max_pages = 20

        while page <= max_pages:
            if page == 1:
                url = f"{base_url}/"
            else:
                url = f"{base_url}/page/{page}/"

            logger.info(f"[Reedsy] Fetching page {page}: {url}")
            html = self.fetch_page(url, delay)
            if not html:
                break

            self.save_raw(html, self.SOURCE, f"page_{page}")
            entries = self._parse_page(html)

            if not entries:
                logger.info(f"[Reedsy] No entries on page {page}, stopping.")
                break

            all_results.extend(entries)
            logger.info(f"[Reedsy] Page {page}: {len(entries)} entries (total: {len(all_results)})")

            has_next = f"/page/{page + 1}/" in html
            if not has_next:
                break
            page += 1

        logger.info(f"[Reedsy] Scraping complete: {len(all_results)} total entries")
        return all_results

    def _parse_page(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        cards = soup.select("div.directory-result")
        entries = []

        for card in cards:
            try:
                entry = self._parse_card(card)
                if entry:
                    entries.append(entry)
            except Exception as e:
                logger.warning(f"[Reedsy] Failed to parse card: {e}")

        return entries

    def _parse_card(self, card) -> dict | None:
        title_el = card.select_one("h3 a.no-decoration")
        if not title_el:
            return None
        title = title_el.get_text(strip=True)
        detail_url = title_el.get("href", "")

        org_el = card.select_one("h3 + p") or card.select_one(".grid-column > .grid p")
        if org_el:
            org_text = org_el.get_text(strip=True)
            if org_text.startswith("Genres:"):
                organization = ""
            else:
                organization = org_text
        else:
            organization = ""

        genres = ""
        for p in card.find_all("p"):
            b = p.find("b")
            if b and "Genres:" in b.get_text():
                genres = p.get_text(strip=True).replace("Genres:", "").strip()
                break

        desc_parts = card.select(".grid-column > p")
        description = ""
        for p in desc_parts:
            text = p.get_text(strip=True)
            if not text.startswith(("Genres:", "Top Prize:", "Additional", "Entry fee:", "Deadline:")):
                b = p.find("b")
                if not b:
                    description = text
                    break

        top_prize = ""
        prize_el = card.select_one("p.h3.fgColor-accent")
        if prize_el:
            top_prize = prize_el.get_text(strip=True)

        additional_prizes = ""
        for p in card.find_all("p"):
            b = p.find("b")
            if b and "Additional prizes:" in b.get_text():
                next_p = p.find_next_sibling("p")
                if next_p:
                    additional_prizes = next_p.get_text(strip=True)
                break

        entry_fee = ""
        deadline = ""
        expired = False
        for p in card.find_all("p"):
            b = p.find("b")
            if not b:
                continue
            label = b.get_text(strip=True)
            if "Entry fee:" in label:
                entry_fee = p.get_text(strip=True).replace(label, "").strip()
            elif "Deadline:" in label:
                deadline_text = p.get_text(strip=True).replace(label, "").strip()
                if "(Expired)" in deadline_text:
                    expired = True
                    deadline_text = deadline_text.replace("(Expired)", "").strip()
                deadline = deadline_text

        return {
            "title": title,
            "organization": organization,
            "top_prize": top_prize,
            "additional_prizes": additional_prizes,
            "entry_fee": entry_fee,
            "deadline": deadline,
            "deadline_expired": expired,
            "genres": genres,
            "description": description,
            "detail_url": detail_url,
            "source": self.SOURCE,
        }
