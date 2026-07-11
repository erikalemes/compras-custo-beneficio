# Metodologia do ranking

Nota final 0–100 = soma ponderada de 7 componentes. Pesos em
`backend/app/core/config.py::DEFAULT_WEIGHTS` (sobrescrevíveis por ambiente):

| Componente | Peso | Cálculo |
| --- | --- | --- |
| Preço total entregue | 30% | `menor_total / total_da_oferta × 100`. A oferta mais barata válida marca 100. |
| Avaliações | 20% | `média/5 × 100` amortecida pela confiança `min(1, log10(qtd+1)/3)` — 1000+ avaliações ≈ confiança total; sem avaliações = 30 (neutro baixo). |
| Reputação | 15% | Loja 60% + vendedor 40% (quando localizado). Excelente=100, boa=80, regular=55, ruim=25, crítica=10, não localizada/insuficiente=40 + alerta. |
| Especificações | 15% | `40 + (desejáveis atendidos / total desejáveis) × 60`; sem critérios desejáveis = 60 (neutro). |
| Histórico de preços | 10% | Classificação do preço atual: muito baixo=100, baixo=80, na média=60, alto=30, muito alto=10, insuficiente=50. |
| Garantia e pós-venda | 5% | Nacional ≥12m=100, nacional <12m=80, vendedor=60, internacional=40+alerta, sem garantia=15, não informada=30. |
| Condições comerciais | 5% | Base 40 + Pix(15) + 6x+ sem juros(15) + cupom validado(10) + cashback(10) + estoque(10), teto 100. |

O **prazo de entrega tem peso zero** (informativo), mas gera alerta quando ausente ou > 30 dias.

Cada componente devolve também um texto de explicação, exibido em "Como a nota foi calculada" na
interface e exportado no Excel. Nada na nota é caixa-preta.

## Classificações

Atribuídas em `ranking/scorer.py::assign_labels`, somente quando há dados suficientes:

- **Melhor custo-benefício**: maior nota final.
- **Menor preço**: menor preço total entregue (mesmo com reputação ruim — o alerta acompanha).
- **Menor preço confiável**: menor total entre lojas boa/excelente, vendedor sem reputação
  ruim/crítica e 20+ avaliações.
- **Melhor avaliado**: maior média com 20+ avaliações (desempate pela quantidade).
- **Compra mais segura**: reputação + garantia nacional + volume de avaliações.
- **Econômica / Intermediária / Premium**: melhor nota dentro de cada tercil de preço (3+ ofertas).
- **Melhor opção importada**: maior nota entre importados, quando existirem.

## Histórico (seção 22)

Janela de 180 dias, mínimo 5 observações. Estatísticas por percentis interpolados (robustos a
extremos). Classificação do preço atual: ≤p10 muito baixo · ≤p35 baixo · ≤p65 na média ·
≤p90 alto · >p90 muito alto. Tendência: média do último terço vs. primeiro terço (±3% = estável).
No modo demo o histórico é semeado com dados fictícios determinísticos (seed 42) e **sempre
identificado** como demonstração na UI e no Excel.
