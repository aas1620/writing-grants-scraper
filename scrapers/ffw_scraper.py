import re

from bs4 import BeautifulSoup

from .base import BaseScraper, make_id, logger


class FFWScraper(BaseScraper):
    """Scrapes FundsForWriters grants page.

    This source is unstructured editorial content. Entries follow the pattern:
    TITLE IN CAPS
    [URL]
    Deadline date. Description text with amounts and details.
    """

    SOURCE = "ffw"

    def __init__(self, config: dict):
        super().__init__(config)
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        })

    def scrape(self) -> list[dict]:
        cfg = self.config["sources"]["fundsforwriters"]
        url = cfg["url"]
        delay = cfg["request_delay_sec"]

        logger.info(f"[FFW] Fetching: {url}")
        html = self.fetch_page(url, delay)
        if not html:
            logger.warning("[FFW] Could not fetch page (may be blocked by WAF). Skipping.")
            return []

        self.save_raw(html, self.SOURCE, "page_1")
        entries = self._parse_page(html)
        logger.info(f"[FFW] Scraping complete: {len(entries)} total entries")
        return entries

    def _parse_page(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        content = soup.select_one(".entry-content") or soup.select_one("article") or soup.select_one(".post-content")
        if not content:
            logger.warning("[FFW] Could not find content container")
            return []

        text = content.get_text("\n", strip=False)
        return self._parse_text_entries(text)

    def _parse_text_entries(self, text: str) -> list[dict]:
        lines = text.split("\n")
        entries = []
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            if self._is_title_line(line):
                title = line
                url = ""
                body_lines = []

                j = i + 1
                while j < len(lines):
                    next_line = lines[j].strip()
                    if not next_line:
                        j += 1
                        continue

                    url_match = re.search(r'https?://[^\s\]]+', next_line)
                    if url_match and not url:
                        url = url_match.group(0).rstrip(".")
                        j += 1
                        continue

                    if self._is_title_line(next_line):
                        break

                    body_lines.append(next_line)
                    j += 1

                body = " ".join(body_lines)
                if title and (url or body):
                    entry = self._extract_fields(title, url, body)
                    entries.append(entry)

                i = j
            else:
                i += 1

        return entries

    def _is_title_line(self, line: str) -> bool:
        if len(line) < 5 or len(line) > 120:
            return False
        alpha = re.sub(r'[^a-zA-Z]', '', line)
        if not alpha:
            return False
        upper_ratio = sum(1 for c in alpha if c.isupper()) / len(alpha)
        return upper_ratio > 0.7

    def _extract_fields(self, title: str, url: str, body: str) -> dict:
        deadline = ""
        deadline_match = re.search(
            r'[Dd]eadline\s+(\w+\s+\d{1,2},?\s+\d{4}|\w+\s+\d{1,2}\b|\d{1,2}/\d{1,2}/\d{2,4})',
            body
        )
        if deadline_match:
            deadline = deadline_match.group(1).strip()

        amounts = re.findall(r'\$[\d,]+(?:\.\d{2})?', body)
        award_amount = amounts[0] if amounts else ""

        location_match = re.search(r'[Ll]ocation\s+(.+?)(?:\.|$)', body)
        location = location_match.group(1).strip() if location_match else ""

        return {
            "title": title.title(),
            "organization": "",
            "award_amount": award_amount,
            "entry_fee": "",
            "deadline": deadline,
            "description": body[:500],
            "detail_url": url,
            "location": location,
            "source": self.SOURCE,
        }
