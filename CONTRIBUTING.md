# Contribuindo

Obrigado pelo interesse em contribuir com o Compras Custo-Benefício!

## Como contribuir

1. Abra uma issue descrevendo o problema ou a proposta.
2. Faça um fork e crie um branch: `git checkout -b minha-melhoria`.
3. Instale as dependências (veja o README).
4. Rode os testes antes de enviar: `pytest` no backend e `npm test` no frontend.
5. Abra um Pull Request explicando o que mudou e por quê.

## Padrões de código

- Backend: Ruff + Black + MyPy (configurados em `backend/pyproject.toml`).
- Frontend: ESLint + Prettier.
- Commits descritivos, em português ou inglês.

## Adicionando uma nova fonte de pesquisa (adaptador)

O guia completo está em [docs/fontes-de-dados.md](docs/fontes-de-dados.md).
Resumo: crie uma classe que herda de `SourceAdapter` em `backend/app/providers/`,
implemente `search()` e registre no `registry.py`. Nunca inclua credenciais no
código; use variáveis de ambiente e forneça um modo simulado para quem não tem chaves.

## Regras que não podem ser quebradas

- CEP obrigatório em toda pesquisa.
- Amazon sempre consultada (real ou simulada), com status informado.
- Ranking baseado no preço total entregue.
- Cashback nunca abatido do preço imediato.
- Funcionamento completo sem credenciais (modo demonstração).
- Nenhum mecanismo para burlar CAPTCHA, autenticação ou bloqueios técnicos.
