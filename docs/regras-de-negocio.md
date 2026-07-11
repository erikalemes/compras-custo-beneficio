# Regras de negócio

Regras invioláveis (seção 46 do escopo):

1. **CEP obrigatório.** Nenhuma pesquisa roda sem CEP brasileiro válido. Cidade e estado são
   mostrados para conferência. Oferta sem confirmação de entrega para o CEP não entra no ranking
   principal nem recebe classificação; aparece em "Ofertas não validadas para o CEP informado".
2. **Amazon sempre consultada.** O status aparece na tela de progresso e nos resultados. Quando não
   há oferta compatível: "A Amazon foi consultada, mas não foi localizada uma oferta compatível com
   os requisitos e com entrega para o CEP informado."
3. **Preço total entregue** = preço + frete + impostos + taxas − desconto Pix − cupom válido.
   É a base do ranking e da coluna principal do Excel.
4. **Cupom** só é descontado quando `validated=true` e o valor mínimo é atendido. Caso contrário é
   exibido apenas como oportunidade, com alerta.
5. **Cashback nunca é abatido** do preço imediato. Aparece como "benefício posterior estimado", com
   plataforma, prazo e regras.
6. **Somente produtos novos.** Usados/recondicionados são descartados na normalização.
7. **Parcelamento com juros não entra** no cálculo principal; gera alerta quando presente.
8. **Reputação baixa não elimina** a oferta: reduz a nota e gera alerta. Reputação não localizada
   gera aviso específico.
9. **Garantia internacional não elimina**: reduz a nota do componente garantia e gera alerta.
10. **Importados** participam quando `allow_imported=true` e trazem custo de importação detalhado;
    risco de cobrança posterior gera alerta obrigatório.
11. **Tolerância de equivalência**: 10% padrão para critérios quantitativos `approx`
    (ex.: 450 L aceita 405–495 L), configurável por critério e no arquivo central.
12. **Histórico**: mínimo de 5 observações em 180 dias; classificação por percentis
    (≤p10 muito baixo, ≤p35 baixo, ≤p65 na média, ≤p90 alto, >p90 muito alto); tendência pela média
    do primeiro vs. último terço (±3%). Histórico demo é sempre marcado como fictício.
13. **Faixas de preço** (econômica/intermediária/premium): tercis da distribuição dos preços
    totais encontrados, nunca valores fixos universais; exigem 3+ ofertas.
14. **Classificação só com dados suficientes**: ex. "menor preço confiável" exige reputação
    boa/excelente da loja, vendedor sem reputação ruim/crítica e 20+ avaliações; "melhor avaliado"
    exige 20+ avaliações.
15. **Sem cadastro**: preferências, favoritos e histórico de pesquisas ficam no navegador
    (IndexedDB). CEP só é salvo com consentimento explícito.
16. **Sem burlar bloqueios**: nenhum código contorna CAPTCHA, autenticação, rate limits ou termos
    de uso. Scraping não faz parte desta versão; se adicionado, será modular, opcional e desativado
    por padrão.
