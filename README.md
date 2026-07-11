# Compras Custo-Benefício

**Demonstração online (celular e computador):** https://erikalemes.github.io/compras-custo-beneficio/

Aplicação web **pública, aberta e sem cadastro** para pesquisar produtos vendidos pela internet e
indicar o **melhor custo-benefício** — não apenas o menor preço — de forma transparente e justificável.

> A demonstração no GitHub Pages roda 100% no navegador (modo demo, dados fictícios): interpretação,
> ranking, histórico e Excel são calculados localmente, sem backend. A versão completa (backend
> FastAPI, fontes reais e histórico persistente) roda via Docker ou nos serviços descritos em
> [docs/implantacao.md](docs/implantacao.md).

Você descreve o produto em linguagem natural ("Geladeira frost free, aproximadamente 450 litros,
220 V, nova, até R$ 5.000"), informa seu CEP e a aplicação:

1. interpreta a descrição e monta critérios obrigatórios/desejáveis (que você pode revisar);
2. consulta várias fontes em paralelo (a Amazon é sempre consultada);
3. valida entrega para o seu CEP e calcula o **preço total entregue** (produto + frete + impostos + taxas − Pix − cupom válido);
4. pondera avaliações, reputação da loja/vendedor, garantia e histórico de preços;
5. entrega um ranking 0–100 explicável, com destaques, alertas, gráfico de histórico e exportação para Excel.

> Preços e ofertas mudam; confirme as condições na loja antes de comprar. A classificação é
> informativa e não constitui recomendação de compra. Veja [LICENSE](LICENSE) para todos os avisos.

## Funcionalidades

- Pesquisa em linguagem natural com interpretação por regras (sem depender de IA externa)
- CEP obrigatório com identificação de cidade/estado e validação de entrega por oferta
- Etapa de confirmação: mover critérios entre obrigatório/desejável/indiferente, editar valores, adicionar/remover, preço máximo, bloquear importados
- Produtos equivalentes com tolerância configurável (10% padrão) e explicação das diferenças
- Preço total entregue com Pix, cupom validado, frete, impostos e taxas; **cashback nunca abatido** (exibido como benefício posterior)
- Ranking 0–100 com 7 componentes ponderados e justificativa por componente
- Classificações: melhor custo-benefício, menor preço, menor preço confiável, melhor avaliado, compra mais segura, faixas econômica/intermediária/premium, melhor importada
- Reputação de loja e vendedor com alertas (arquitetura de adaptadores de reputação)
- Histórico de preços de 6 meses com estatística transparente (percentis, mediana, tendência) e gráfico
- Favoritos e histórico de pesquisas no navegador (IndexedDB), com consentimento para salvar o CEP
- Exportação para Excel real (.xlsx, openpyxl) com 4 abas formatadas
- Três modos: **demo** (sem credenciais), **public** (APIs públicas) e **production** (com credenciais)
- Acessibilidade: HTML semântico, labels, foco visível, aria-live, navegação por teclado

## Arquitetura

Monorepo com frontend e backend independentes:

```
compras-custo-beneficio/
├── frontend/          # Next.js 14 + TypeScript + Tailwind (App Router)
├── backend/           # FastAPI + Pydantic v2 + SQLAlchemy 2 (Python 3.11+)
│   └── app/
│       ├── api/       # endpoints REST (documentados em /docs)
│       ├── core/      # config central (nome, pesos, tolerância), banco, logs
│       ├── models/    # tabelas (histórico de preços, log de coletas)
│       ├── schemas/   # modelos Pydantic (Offer, RankedOffer, Criterion...)
│       ├── services/  # CEP, interpretação, preço total, equivalência, busca
│       ├── providers/ # adaptadores de fontes (Amazon, Mercado Livre, demos)
│       ├── ranking/   # pontuação 0-100 explicável + classificações
│       ├── history/   # histórico de 6 meses + estatística
│       ├── reputation/# adaptadores de reputação
│       └── exports/   # Excel (.xlsx) com openpyxl
├── data/demo/         # catálogo de demonstração (dados fictícios identificados)
├── docs/              # arquitetura, regras de negócio, metodologia, implantação...
└── .github/workflows/ # CI (lint, testes, build, Docker, vulnerabilidades)
```

Detalhes em [docs/arquitetura.md](docs/arquitetura.md).

## Requisitos

- Python 3.11+ (testado com 3.12)
- Node.js 20+
- (Opcional) Docker + Docker Compose

## Execução local (modo demonstração, sem nenhuma credencial)

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | Linux/macOS: source .venv/bin/activate
pip install -r requirements/dev.txt
uvicorn app.main:app --reload --port 8000
```

API disponível em `http://localhost:8000` (documentação interativa em `/docs`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplicação em `http://localhost:3000`. Os scripts `scripts/dev.sh` (Linux/macOS) e
`scripts/dev.ps1` (Windows) sobem os dois de uma vez.

## Docker

```bash
docker compose up --build
# frontend: http://localhost:3000 | backend: http://localhost:8000
```

O modo demonstração não exige nenhum serviço pago nem chave de API.

## Variáveis de ambiente

Copie `.env.example` para `.env`. Principais:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `APP_MODE` | `demo` | `demo` (dados locais), `public` (adiciona Mercado Livre via API pública), `production` |
| `APP_NAME` | Compras Custo-Benefício | Nome exibido (troca centralizada) |
| `DATABASE_URL` | `sqlite:///./app.db` | Use `postgresql+psycopg://...` em produção |
| `CORS_ORIGINS` | `http://localhost:3000` | Origens permitidas, separadas por vírgula |
| `MASK_CEP_IN_LOGS` | `true` | Mascara o CEP nos logs estruturados |
| `AMAZON_PAAPI_*` | vazio | Credenciais da Product Advertising API (opcional) |
| `MELI_ACCESS_TOKEN` | vazio | Token do Mercado Livre (opcional, aumenta limites) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL do backend usada pelo frontend |

## Testes

```bash
# Backend (38 testes: CEP, interpretação, preço, cupom, cashback, importados,
# tolerância, ranking, alertas, histórico, Excel, fluxo completo)
cd backend && pytest

# Lint e formatação
ruff check app tests && black --check app tests

# Frontend
cd frontend && npm test && npm run lint
```

## Exportação para Excel

Na página de resultados, o botão "Exportar para Excel" baixa um `.xlsx` real com 4 abas:
Comparativo, Histórico de preços, Critérios da pesquisa e Fontes e alertas — com cabeçalhos
formatados, filtros, primeira linha congelada, formatação monetária e links clicáveis.

## Modos e fontes de dados

| Fonte | demo | public | production |
| --- | --- | --- | --- |
| Amazon Brasil | simulada | simulada | PA-API se houver credenciais (ver limitações) |
| MegaLoja Brasil (fictícia) | ✔ | ✔ | ✔ |
| ImportaDireto (fictícia) | ✔ | ✔ | ✔ |
| Mercado Livre (API pública) | — | ✔ | ✔ |

A interface indica o modo ativo e marca toda oferta simulada. O adaptador da Amazon deixa claro
quando usa dados simulados; a chamada real da PA-API exige conta de associado aprovada e assinatura
SigV4, ainda não certificada nesta versão (documentado em
[docs/fontes-de-dados.md](docs/fontes-de-dados.md), que também ensina a **criar um novo adaptador**).

## Implantação

Guia completo em [docs/implantacao.md](docs/implantacao.md): frontend na Vercel, backend em
Render/Railway/Fly.io, PostgreSQL gerenciado em produção e Docker para execução local.

## Limitações conhecidas

- Modo demo usa catálogo fictício claramente identificado (18 ofertas em 6 categorias).
- Mercado Livre (API pública) não cota frete por CEP; essas ofertas aparecem como "não validadas para o CEP".
- Integração real da Amazon PA-API e do Reclame Aqui dependem de credenciais/parcerias; interfaces e adaptadores prontos, chamadas reais pendentes.
- Histórico real é construído a cada pesquisa executada; não inventamos dados passados.
- Testes de ponta a ponta com Playwright estão no roadmap.

## Roadmap

Ver [docs/roadmap.md](docs/roadmap.md).

## Licença e contribuição

MIT ([LICENSE](LICENSE)). Contribuições são bem-vindas — leia
[CONTRIBUTING.md](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md).
