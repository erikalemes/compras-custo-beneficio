# Implantação

O modo demonstração roda inteiro em serviços gratuitos. Nenhum serviço pago é exigido.

## GitHub Pages — demonstração estática (já no ar)

**https://erikalemes.github.io/compras-custo-beneficio/**

O workflow `.github/workflows/pages.yml` compila o frontend com `NEXT_PUBLIC_STATIC_DEMO=true`
(Next.js `output: export`) e publica em Pages a cada push na main. Nesse modo toda a "API" roda no
navegador (`frontend/src/lib/demo/`): interpretação, CEP offline, ranking, histórico determinístico
e Excel via exceljs. Serve para usar e compartilhar a demonstração; o histórico não persiste entre
pesquisas e as fontes são o catálogo fictício. Para dados reais, use as opções abaixo.

## Frontend — Vercel

1. Importe o repositório na Vercel e defina **Root Directory = `frontend`**.
2. Variáveis de ambiente: `NEXT_PUBLIC_API_URL=https://sua-api.onrender.com` (URL do backend).
3. Build padrão (`npm run build`). O App Router gera páginas estáticas + client components.

## Backend — Render (ou Railway/Fly.io)

**Render (Blueprint, mais fácil):** New + → Blueprint → escolha o repositório. O arquivo
`render.yaml` na raiz cria o serviço sozinho (Docker, plano free, modo demo). Depois de criar o
frontend na Vercel, edite a variável `CORS_ORIGINS` no painel do Render para o endereço do frontend.

**Render (manual):**
1. New → Web Service → aponte para o repositório.
2. Runtime: Docker · Dockerfile path: `backend/Dockerfile` · Docker build context: raiz do repo.
3. Variáveis: `APP_MODE=demo` (ou `public`), `CORS_ORIGINS=https://seu-front.vercel.app`.
4. Para produção: crie um PostgreSQL gerenciado e defina
   `DATABASE_URL=postgresql+psycopg://usuario:senha@host/db` (adicione `psycopg[binary]` ao
   `requirements/base.txt` ao ativar PostgreSQL).

**Railway/Fly.io:** mesmo Dockerfile; ajuste apenas as variáveis.

## Docker local

```bash
docker compose up --build
```

Sobe backend (8000, com healthcheck) e frontend (3000). O volume `backend-data` preserva o
histórico de preços entre reinícios.

## Checklist de produção

- [ ] `APP_MODE=production` e credenciais reais via variáveis de ambiente
- [ ] `CORS_ORIGINS` restrito ao domínio do frontend
- [ ] PostgreSQL gerenciado com backup
- [ ] `MASK_CEP_IN_LOGS=true`
- [ ] Rate limit adequado ao tráfego (`RATE_LIMIT`)
- [ ] Monitorar `/health`
