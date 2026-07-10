"""Endpoints da API (secao 31). Documentacao automatica em /docs."""

import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.exports.excel import build_workbook
from app.providers.registry import get_active_adapters
from app.schemas.models import (
    CepInfo,
    InterpretedQuery,
    InterpretRequest,
    SearchRequest,
    SearchResults,
)
from app.services import search as search_service
from app.services.cep import lookup_cep
from app.services.demo_seed import seed_demo_history
from app.services.interpreter import interpret

router = APIRouter()


@router.get("/health", tags=["infra"])
async def health() -> dict:
    s = get_settings()
    return {"status": "ok", "mode": s.app_mode, "app_name": s.app_name}


@router.get("/api/config", tags=["infra"])
async def config() -> dict:
    s = get_settings()
    return {
        "app_name": s.app_name,
        "mode": s.app_mode,
        "ranking_weights": s.ranking_weights,
        "tolerance": s.tolerance,
    }


@router.get("/api/sources", tags=["fontes"])
async def sources() -> list[dict]:
    return [a.describe() for a in get_active_adapters()]


@router.get("/api/cep/{cep}", response_model=CepInfo, tags=["cep"])
async def validate_cep(cep: str) -> CepInfo:
    if len(cep) > 9:
        raise HTTPException(status_code=422, detail="CEP inválido.")
    return await lookup_cep(cep)


@router.post("/api/interpret", response_model=dict, tags=["pesquisa"])
async def interpret_query(payload: InterpretRequest) -> dict:
    cep_info = await lookup_cep(payload.cep)
    if not cep_info.valid:
        raise HTTPException(status_code=422, detail=f"CEP inválido: {cep_info.message}")
    query = interpret(payload.text, payload.max_price, payload.allow_imported)
    return {"query": query.model_dump(), "cep": cep_info.model_dump()}


@router.post("/api/search", tags=["pesquisa"])
async def run_search(payload: SearchRequest) -> dict:
    cep_info = await lookup_cep(payload.cep)
    if not cep_info.valid:
        raise HTTPException(status_code=422, detail=f"CEP inválido: {cep_info.message}")
    result = await search_service.start_search(payload.query, cep_info)
    return {"search_id": result.search_id, "status": result.status}


@router.get("/api/search/{search_id}", response_model=SearchResults, tags=["pesquisa"])
async def search_status(search_id: str) -> SearchResults:
    result = search_service.get_search(search_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Pesquisa não encontrada ou expirada.")
    return result


@router.get("/api/search/{search_id}/export", tags=["exportacao"])
async def export_excel(search_id: str) -> StreamingResponse:
    result = search_service.get_search(search_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Pesquisa não encontrada ou expirada.")
    if result.status != "concluida":
        raise HTTPException(status_code=409, detail="A pesquisa ainda não foi concluída.")
    content = build_workbook(result)
    filename = f"comparativo-{search_id}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/api/demo/load", tags=["demo"])
async def load_demo() -> dict:
    if get_settings().app_mode != "demo":
        raise HTTPException(status_code=409, detail="Disponível apenas no modo demonstração.")
    created = seed_demo_history()
    return {"seeded_observations": created, "message": "Histórico de demonstração pronto."}


def build_example_query() -> InterpretedQuery:
    return interpret("Geladeira frost free 450 litros 220 V até R$ 5.000")
