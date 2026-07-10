"""Aplicacao FastAPI — Compras Custo-Beneficio."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import router
from app.core.config import get_settings
from app.core.database import init_db
from app.core.logging import setup_logging
from app.services.demo_seed import seed_demo_history

settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    init_db()
    if settings.app_mode == "demo":
        seed_demo_history()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Comparador aberto de custo-benefício para compras online no Brasil.",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Muitas requisições. Aguarde um instante."})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Nunca expor rastreamento interno ao usuario (secao 31).
    return JSONResponse(status_code=500, content={"detail": "Erro interno. Tente novamente."})


app.include_router(router)
