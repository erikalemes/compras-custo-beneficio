"""Configuracao dos testes: modo demo, banco temporario, sem rede."""

import os
import tempfile
from pathlib import Path

_tmpdir = tempfile.mkdtemp(prefix="ccb-tests-")
os.environ.setdefault("APP_MODE", "demo")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmpdir) / 'test.db'}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # dispara o lifespan (init_db + seed demo)
        yield c


@pytest.fixture(scope="session", autouse=True)
def _db():
    init_db()
