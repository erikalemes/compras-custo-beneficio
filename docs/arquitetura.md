# Arquitetura

## Visão geral

Monorepo com dois aplicativos independentes que conversam por HTTP/JSON:

- **frontend/** — Next.js 14 (App Router), TypeScript, Tailwind CSS. Todas as páginas interativas
  são client components; dados do usuário ficam no navegador (IndexedDB).
- **backend/** — FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy 2. Camadas: API → serviços →
  provedores/ranking/histórico → banco.

## Fluxo da pesquisa (seção 32 do escopo)

```
POST /api/interpret  ──► valida CEP (ViaCEP ou base offline) + interpreta texto (regras/regex)
        │                        └► InterpretedQuery {categoria, critérios, tolerância}
        ▼  (usuário revisa na página /confirmar)
POST /api/search     ──► cria tarefa asyncio, retorna search_id
        │
        ▼  GET /api/search/{id}  (polling)
  consulta fontes em paralelo (asyncio.gather)
  → valida condição "novo" e entrega no CEP
  → calcula preço total entregue (pricing.py)
  → completa reputação (reputation/adapter.py)
  → consulta histórico (history/store.py)
  → aplica critérios obrigatórios (equivalence.py)
  → pontua 0-100 (ranking/scorer.py) e atribui classificações
  → grava observações de preço (histórico de 6 meses)
        │
        ▼
GET /api/search/{id}/export  ──► .xlsx com 4 abas (exports/excel.py)
```

## Decisões arquiteturais registradas

| Decisão | Motivo |
| --- | --- |
| Estado da pesquisa em memória (dict + tarefa asyncio), não em fila externa | Simplicidade; pesquisas demo/públicas duram < 5 s. A interface por `search_id` permite trocar por Celery/RQ sem mudar a API. |
| Interpretação por regras/regex, IA opcional | Requisito: funcionar sem IA externa. A camada de LLM pode substituir `interpreter.interpret` mantendo o mesmo esquema de saída. |
| SQLite por padrão, PostgreSQL por `DATABASE_URL` | SQLAlchemy 2 abstrai o dialeto; nenhuma query usa recurso específico de SQLite. |
| Gráfico de histórico em SVG próprio | Evita dependência pesada de gráficos para uma única linha; acessível via aria-label. |
| CEP: ViaCEP nos modos public/production, tabela local de faixas no demo/fallback | Demo 100% offline; faixas oficiais dos Correios por prefixo cobrem estado + capitais. |
| Ofertas sem confirmação de entrega vão para seção separada | Regra obrigatória da seção 4: não participam do ranking nem das classificações. |
| Frete/impostos/cupom calculados no backend, nunca no frontend | Única fonte de verdade para o preço total entregue (base do ranking e do Excel). |

## Modelo de dados

Esquemas Pydantic em `backend/app/schemas/models.py` cobrem as entidades da seção 30:
Offer (com Coupon, Cashback, Warranty, ImportCost, ReviewSummary, Reputation embutidos),
Criterion/InterpretedQuery (SearchRequest/SearchCriterion), RankedOffer (SearchResult/RankingResult),
HistoryStats (PriceHistory), SourceStatus (DataSource). Persistência mínima em
`models/orm.py`: `price_history` e `collection_log`.

Normalização de produto (`history/store.py::product_key`): prioridade EAN → código do
fabricante (MPN) → marca+modelo → nome. Identificações probabilísticas registram nível de
confiança no ReviewSummary/notes.

## Segurança (seção 34)

- Entradas validadas por Pydantic (limites de tamanho em `InterpretRequest`).
- Rate limiting global (slowapi, `RATE_LIMIT` configurável).
- CORS restrito a `CORS_ORIGINS`.
- Handler global de exceções: nunca vaza stack trace (resposta padronizada 500).
- Logs estruturados JSON com CEP mascarado (`core/logging.py`).
- Nenhuma URL fornecida pelo usuário é buscada pelo backend (sem superfície de SSRF);
  as URLs de ofertas vêm apenas dos adaptadores.
- Sem credenciais no repositório; `.env.example` documenta tudo.
- CI roda pip-audit e npm audit.
