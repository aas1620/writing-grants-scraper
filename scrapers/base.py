import time
import hashlib
import logging
from pathlib import Path
from abc import ABC, abstractmethod

import requests
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
CONFIG_PATH = PROJECT_ROOT / "config.yaml"


def load_config():
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def make_id(source: str, title: str, url: str) -> str:
    raw = f"{source}:{title}:{url}"
    return f"{source}_{hashlib.md5(raw.encode()).hexdigest()[:8]}"


class BaseScraper(ABC):
    def __init__(self, config: dict):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "WritingGrantsScraper/1.0 (personal research project)"
        })
        self.raw_dir = PROJECT_ROOT / config.get("output", {}).get("raw_dir", "data/raw")
        self.raw_dir.mkdir(parents=True, exist_ok=True)

    def fetch_page(self, url: str, delay: float = 1.0) -> str | None:
        max_retries = self.config.get("rate_limiting", {}).get("max_retries", 3)
        backoff = self.config.get("rate_limiting", {}).get("retry_backoff_sec", 5.0)

        for attempt in range(max_retries):
            try:
                time.sleep(delay)
                resp = self.session.get(url, timeout=30)
                resp.raise_for_status()
                return resp.text
            except requests.RequestException as e:
                logger.warning(f"Attempt {attempt + 1}/{max_retries} failed for {url}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(backoff * (attempt + 1))
        logger.error(f"All {max_retries} attempts failed for {url}")
        return None

    def save_raw(self, html: str, source_name: str, page_id: str):
        path = self.raw_dir / f"{source_name}_{page_id}.html"
        path.write_text(html, encoding="utf-8")

    @abstractmethod
    def scrape(self) -> list[dict]:
        pass
