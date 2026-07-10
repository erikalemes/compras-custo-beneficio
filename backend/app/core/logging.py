"""Logs estruturados com mascaramento de CEP (secao 36)."""

import json
import logging
import re
import sys
from datetime import UTC, datetime

from app.core.config import get_settings

_CEP_RE = re.compile(r"\b(\d{5})-?(\d{3})\b")


def mask_cep(text: str) -> str:
    """74000-000 -> 74***-***. Mantem so o prefixo regional."""
    return _CEP_RE.sub(lambda m: f"{m.group(1)[:2]}***-***", text)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        msg = record.getMessage()
        if get_settings().mask_cep_in_logs:
            msg = mask_cep(msg)
        payload = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": msg,
        }
        return json.dumps(payload, ensure_ascii=False)


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
