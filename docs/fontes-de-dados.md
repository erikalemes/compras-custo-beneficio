# Fontes de dados e adaptadores

## Fontes atuais

| Adaptador | Arquivo | Tipo | Modo real? |
| --- | --- | --- | --- |
| Amazon Brasil | `providers/amazon.py` | API (PA-API 5.0) | Simulado. Detecta credenciais (`AMAZON_PAAPI_*`), mas a chamada assinada (AWS SigV4) e a aprovação no programa de associados ainda não foram certificadas; quando houver credenciais, registra a limitação e usa o catálogo simulado com aviso explícito. |
| Mercado Livre | `providers/mercadolivre.py` | API pública | Real (modo `public`/`production`). Sem cotação de frete por CEP no endpoint público → ofertas entram como "não validadas para o CEP". |
| MegaLoja Brasil | `providers/megaloja_demo.py` | demo | Fictícia, para demonstração. |
| ImportaDireto | `providers/importadireto_demo.py` | demo | Fictícia, demonstra fluxo de importados. |

O catálogo demo (`data/demo/products.json`) tem 18 ofertas em 6 categorias, com preços, avaliações
e reputações **fictícios** e claramente identificados (`simulated: true`).

## Reputação

Interface em `reputation/adapter.py` (`ReputationAdapter`). O Reclame Aqui não oferece API pública
aberta; a integração real depende de parceria e dos termos de uso da plataforma. A versão atual usa
uma base local de demonstração e completa apenas ofertas cuja fonte não trouxe reputação.

## Como criar um novo adaptador de loja

1. Crie `backend/app/providers/minhaloja.py`:

```python
from app.providers.base import SourceAdapter
from app.schemas.models import CepInfo, InterpretedQuery, Offer

class MinhaLojaAdapter(SourceAdapter):
    name = "Minha Loja"
    kind = "api"          # demo | api | feed
    simulated = False

    async def search(self, query: InterpretedQuery, cep: CepInfo) -> list[Offer]:
        # 1. Monte a consulta a partir de query.original_text / query.category.
        # 2. Chame a API oficial da loja (httpx, timeout de get_settings().http_timeout_seconds).
        # 3. Converta cada item em Offer, preenchendo o máximo de campos.
        #    - delivery_available: True somente com confirmação real para o CEP;
        #      None quando não for possível confirmar (vai para a seção separada).
        #    - NUNCA filtre pelos critérios do usuário; o núcleo faz isso.
        # 4. Em erro de rede, deixe a exceção subir: o núcleo marca a fonte como
        #    indisponível sem derrubar a pesquisa.
        ...
```

2. Registre em `providers/registry.py` no(s) modo(s) adequado(s).
3. Credenciais: adicione campos em `core/config.py` + `.env.example`. Nunca no código.
4. Se a fonte exigir credenciais, implemente também um caminho simulado (dados em `data/demo/`)
   para que o repositório continue funcionando sem chaves.
5. Adicione testes em `backend/tests/` (o padrão dos demos serve de modelo).

## Regras obrigatórias para adaptadores

- Priorizar APIs oficiais e feeds autorizados.
- Coleta automatizada só quando permitida pelos termos de uso; sempre modular e desativada por padrão.
- Proibido burlar CAPTCHA, autenticação, bloqueios técnicos ou controles antifraude.
- Registrar `source`, `source_kind`, `collected_at` e `simulated` em cada oferta.
