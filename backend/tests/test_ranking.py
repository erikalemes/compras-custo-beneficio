from app.ranking.scorer import assign_labels, build_alerts, score_offer
from app.schemas.models import (
    HistoryStats,
    Offer,
    RankedOffer,
    Reputation,
    ReviewSummary,
    Warranty,
)
from app.services.pricing import compute_price_breakdown


def _ranked(offer: Offer) -> RankedOffer:
    return RankedOffer(offer=offer, price_breakdown=compute_price_breakdown(offer))


def _offer(oid: str, price: float, **kw) -> Offer:
    base = {
        "offer_id": oid, "product_name": f"Produto {oid}", "price": price, "price_pix": price,
        "delivery_available": True, "shipping_cost": 0.0,
        "reviews": ReviewSummary(average=4.5, count=500),
        "store_reputation": Reputation(classification="boa", score=7.5),
        "warranty": Warranty(months=12, kind="nacional"),
    }
    base.update(kw)
    return Offer(**base)


def test_score_entre_0_e_100():
    r = _ranked(_offer("a", 1000.0))
    score_offer(r, best_total=1000.0, total_desirable=0)
    assert 0 <= r.score <= 100
    assert set(r.score_breakdown) == {
        "preco_total", "avaliacoes", "reputacao", "especificacoes", "historico", "garantia", "condicoes",
    }
    assert all(r.score_explanations.values())


def test_menor_preco_pontua_mais_no_componente_preco():
    barato = _ranked(_offer("a", 1000.0))
    caro = _ranked(_offer("b", 1500.0))
    score_offer(barato, 1000.0, 0)
    score_offer(caro, 1000.0, 0)
    assert barato.score_breakdown["preco_total"] > caro.score_breakdown["preco_total"]


def test_alerta_reputacao_ruim():
    r = _ranked(_offer("a", 1000.0, store_reputation=Reputation(classification="ruim", score=3.0)))
    build_alerts(r)
    assert any("reputação" in a for a in r.alerts)


def test_alerta_garantia_internacional():
    r = _ranked(_offer("a", 1000.0, warranty=Warranty(months=6, kind="internacional")))
    build_alerts(r)
    assert any("garantia internacional" in a.lower() for a in r.alerts)


def test_labels_e_faixas():
    offers = [
        _ranked(_offer("barato", 1000.0)),
        _ranked(_offer("medio", 2000.0)),
        _ranked(_offer("caro", 3000.0)),
    ]
    for r in offers:
        r.history = HistoryStats()
        score_offer(r, 1000.0, 0)
    highlights, bands = assign_labels(offers)
    assert highlights["menor_preco"] == "barato"
    assert "melhor_custo_beneficio" in highlights
    assert set(bands) == {"economica", "intermediaria", "premium"}
    assert offers[0].price_band == "economica"
    assert offers[2].price_band == "premium"


def test_menor_preco_confiavel_ignora_reputacao_ruim():
    ruim = _ranked(_offer("ruim", 900.0, store_reputation=Reputation(classification="ruim", score=3.0)))
    boa = _ranked(_offer("boa", 1000.0))
    for r in (ruim, boa):
        score_offer(r, 900.0, 0)
    highlights, _ = assign_labels([ruim, boa])
    assert highlights["menor_preco"] == "ruim"
    assert highlights["menor_preco_confiavel"] == "boa"
