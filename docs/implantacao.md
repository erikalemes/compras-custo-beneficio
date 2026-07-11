# Implantação

O modo demonstração roda inteiro em serviços gratuitos. Nenhum serviço pago é exigido.

## Frontend — Vercel

1. Importe o repositório na Vercel e defina **Root Directory = `frontend`**.
2. Variáveis de ambiente: `NEXT_PUBLIC_API_URL=https://sua-api.onrender.com` (URL do backend).
3. Build padrão (`npm run build`). O App Router gera páginas estáticas + client components.

## Backend — Render (ou Railway/Fly.io)

**Render (Docker):**
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
