# Fontes de dados e adaptadores

## Política dos modos reais

Nos modos `public` e `production` **nenhuma oferta simulada é exibida**. Fonte sem credencial fica
listada como indisponível com o motivo (campo `unavailable_reason` do adaptador). O modo `demo`
continua existindo apenas para demonstração offline, com tudo claramente rotulado.

## Fontes atuais

| Adaptador | Arquivo | Tipo | Situação |
| --- | --- | --- | --- |
| Lojas VTEX (Novo Mundo e outras via `VTEX_STORES`) | `providers/vtex.py` | API pública do storefront VTEX | **Real, sem credencial.** Busca (`/api/catalog_system/pub/products/search`) com termo literal → simplificado → termo da categoria (equivalentes), e frete real por CEP (`/api/checkout/pub/orderForms/simulation`). A loja não expõe avaliações/reputação: os campos ficam vazios/"não localizada" (nota neutra com aviso), nunca inventados. |
| Amazon Brasil | `providers/amazon.py` | API (PA-API 5.0) | Demo: catálogo fictício rotulado. Modos reais: indisponível até haver credenciais de associado aprovadas + assinatura SigV4 certificada. |
| Mercado Livre | `providers/mercadolivre.py` | API oficial | A API de busca passou a exigir aplicação registrada (403 sem token). Com `MELI_ACCESS_TOKEN` (crie em developers.mercadolivre.com.br) a fonte ativa. |
| Magazine Luiza / Casas Bahia / Ponto Frio | — | sem API pública | Não expõem API aberta e os termos de uso não permitem coleta automatizada. Caminho oficial: programas de afiliados (ex.: Awin/Lomadee), que exigem cadastro aprovado; a arquitetura de adaptadores já comporta essa integração. |
| MegaLoja Brasil | `providers/megaloja_demo.py` | demo | Fictícia, apenas modo demo. |
| ImportaDireto | `providers/importadireto_demo.py` | demo | Fictícia, apenas modo demo (fluxo de importados). |

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
