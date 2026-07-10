# Política de Segurança

## Reportando vulnerabilidades

Se você encontrar uma vulnerabilidade, **não abra uma issue pública**.
Use a aba "Security > Report a vulnerability" do GitHub (private vulnerability
reporting) para reportar de forma privada.

## Escopo

- Backend FastAPI (validação de entrada, SSRF, injeção, rate limiting).
- Frontend Next.js (XSS, dados locais no navegador).
- Geração de arquivos Excel.

## Compromissos do projeto

- Nenhuma credencial no repositório (uso de variáveis de ambiente).
- CEP nunca gravado em logs públicos (mascaramento habilitado por padrão).
- Dependências analisadas no CI (pip-audit e npm audit).
- Sem telemetria invasiva.
