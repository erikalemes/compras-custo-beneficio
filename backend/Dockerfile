# Build a partir da RAIZ do repositorio (para incluir data/demo):
#   docker build -f backend/Dockerfile -t ccb-backend .
FROM python:3.12-slim

WORKDIR /srv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/requirements/base.txt requirements/base.txt
RUN pip install --no-cache-dir -r requirements/base.txt

COPY backend/app app
COPY data/demo /srv/data/demo
ENV DEMO_DATA_DIR=/srv/data/demo

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
