# Requisitos funcionais

Mapeamento do escopo para a implementação. ✔ implementado · ◐ parcial · ✗ pendente.

| # | Requisito | Status | Onde |
| --- | --- | --- | --- |
| RF01 | Pesquisa em linguagem natural | ✔ | `services/interpreter.py`, página inicial |
| RF02 | CEP obrigatório com cidade/estado | ✔ | `services/cep.py`, `/api/cep/{cep}` |
| RF03 | Confirmação e edição de critérios | ✔ | página `/confirmar` |
| RF04 | Critérios obrigatórios eliminam; desejáveis pontuam | ✔ | `services/equivalence.py`, `ranking/scorer.py` |
| RF05 | Tolerância de 10% para equivalentes + explicação das diferenças | ✔ | `equivalence.py` (operador `approx`) |
| RF06 | Arquitetura de adaptadores de fontes | ✔ | `providers/base.py`, `providers/registry.py` |
| RF07 | Amazon sempre consultada, com status | ✔ | `providers/amazon.py`, mensagem na UI |
| RF08 | Diferenciação de tipos de venda na Amazon | ✔ | campo `seller_type` |
| RF09 | Três modos (demo/public/production) com indicação na UI | ✔ | `APP_MODE`, `ModeBadge` |
| RF10 | Preço total entregue como base do ranking | ✔ | `services/pricing.py` |
| RF11 | Cupom só descontado quando validado | ✔ | `pricing.py` + testes |
| RF12 | Cashback nunca abatido, exibido à parte | ✔ | `pricing.py`, UI, Excel |
| RF13 | Somente parcelamento sem juros no cálculo principal | ✔ | `installments_interest_free` + alerta |
| RF14 | Importados com impostos/frete/risco e alerta | ✔ | `ImportCost`, alertas |
| RF15 | Garantia afeta nota; internacional gera alerta | ✔ | `scorer.py::_warranty_score` |
| RF16 | Avaliações além da média (quantidade, resumo, confiança) | ✔ | `ReviewSummary`, `_reviews_score` |
| RF17 | Reputação de loja e vendedor com classificações e alertas | ✔ | `Reputation`, `reputation/adapter.py` |
| RF18 | Ranking 0–100 transparente com pesos configuráveis | ✔ | `core/config.py::DEFAULT_WEIGHTS` |
| RF19 | Classificações (9 tipos) sem atribuir quando faltam dados | ✔ | `scorer.py::assign_labels` |
| RF20 | Faixas de preço por distribuição (tercis) | ✔ | `assign_labels` |
| RF21 | Histórico de 6 meses com estatística transparente e gráfico | ✔ | `history/store.py`, `HistoryChart` |
| RF22 | Armazenamento local sem cadastro (IndexedDB) com consentimento p/ CEP | ✔ | `frontend/src/lib/db.ts` |
| RF23 | Favoritos (oferta e pesquisa) com repesquisa | ✔ | página `/favoritos` |
| RF24 | Excel real com 4 abas formatadas | ✔ | `exports/excel.py` |
| RF25 | Ofertas sem entrega confirmada fora do ranking, em seção própria | ✔ | `search.py`, UI |
| RF26 | Acessibilidade (WCAG 2.1 AA como meta) | ◐ | HTML semântico, labels, foco, aria-live; auditoria formal pendente |
| RF27 | Camada opcional de IA com validação de esquema | ◐ | interface pronta (mesmo esquema `InterpretedQuery`); chamada a LLM pendente |
| RF28 | Regras específicas por categoria | ◐ | 7 categorias com extração própria; pesos por categoria pendentes |
| RF29 | Testes E2E com Playwright | ✗ | roadmap |
