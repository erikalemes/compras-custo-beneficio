#!/usr/bin/env bash
# Sobe backend (porta 8000) e frontend (porta 3000) em modo desenvolvimento.
set -euo pipefail
cd "$(dirname "$0")/.."

(cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000 2>/dev/null \
  || .venv/bin/python -m uvicorn app.main:app --reload --port 8000) &
BACK_PID=$!
trap "kill $BACK_PID" EXIT

cd frontend && npm run dev
