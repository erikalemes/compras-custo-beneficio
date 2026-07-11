# Roadmap

## Fase 1 — Fundação ✔ (entregue)
Monorepo, backend FastAPI, frontend Next.js, Docker, modelos, SQLite, modo demonstração, CI.

## Fase 2 — Fluxo principal ✔ (entregue)
Pesquisa em linguagem natural, CEP obrigatório, confirmação de critérios, ofertas, ranking
explicável, resultados com destaques.

## Fase 3 — Confiança ✔ (entregue)
Avaliações ponderadas, reputação com alertas, importados com custos detalhados, garantia.

## Fase 4 — Histórico e exportação ✔ (entregue)
Histórico de 6 meses com estatística por percentis, gráfico SVG, favoritos locais, Excel 4 abas.

## Fase 5 — Integrações reais ◐ (em andamento)
- [x] Adaptador VTEX genérico com resultados reais sem credencial (Novo Mundo ativo)
- [x] Cotação de frete real por CEP nas lojas VTEX (simulação do checkout)
- [x] Modos reais sem nenhum dado simulado (fontes sem credencial ficam inativas com o motivo)
- [x] Adaptador Mercado Livre pronto (aguarda `MELI_ACCESS_TOKEN`; API exige aplicação registrada)
- [x] Interface e configuração da Amazon PA-API
- [ ] Chamada real assinada (SigV4) da PA-API com conta de associado aprovada
- [ ] Magazine Luiza / Casas Bahia / Ponto Frio via programa de afiliados (exige cadastro aprovado)
- [ ] Fonte de reputação real (parceria/termos do Reclame Aqui ou alternativa)

## Próximas melhorias
- [ ] Testes E2E com Playwright (fluxo completo + acessibilidade + responsividade)
- [ ] Pesos de ranking por categoria (geladeira ≠ notebook)
- [ ] Camada opcional de LLM para interpretação e resumo de avaliações (saída validada por esquema,
      proibida de inventar preços/avaliações/disponibilidade)
- [ ] Comparação lado a lado de 2-4 ofertas
- [ ] Alerta de preço (notificação local quando o preço cair)
- [ ] pre-commit hooks (ruff, black, eslint, prettier)
- [ ] Internacionalização (a base já está em pt-BR)
