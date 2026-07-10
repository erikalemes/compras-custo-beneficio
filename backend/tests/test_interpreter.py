from app.schemas.models import CriterionKind
from app.services.interpreter import interpret


def _by_id(query, cid):
    return next((c for c in query.criteria if c.id == cid), None)


def test_geladeira_completa():
    q = interpret("Geladeira frost free, aproximadamente 450 litros, 220 V, nova, até R$ 5.000")
    assert q.category == "geladeira"
    assert q.max_price == 5000
    ff = _by_id(q, "frost_free")
    assert ff is not None and ff.kind == CriterionKind.OBRIGATORIO
    cap = _by_id(q, "capacidade")
    assert cap is not None and cap.value == 450 and cap.operator == "approx"
    volt = _by_id(q, "voltagem")
    assert volt is not None and volt.value == "220"
    assert _by_id(q, "novo").kind == CriterionKind.OBRIGATORIO
    assert _by_id(q, "entrega_cep").kind == CriterionKind.OBRIGATORIO


def test_notebook():
    q = interpret("Notebook com 16 GB de RAM, SSD de 512 GB, tela de 15 polegadas, até R$ 4.500")
    assert q.category == "notebook"
    assert _by_id(q, "ram").value == 16
    assert _by_id(q, "ssd").value == 512
    assert _by_id(q, "tela").kind == CriterionKind.DESEJAVEL
    assert q.max_price == 4500


def test_ar_condicionado():
    q = interpret("Ar-condicionado inverter 12.000 BTUs 220 V")
    assert q.category == "ar_condicionado"
    assert _by_id(q, "btus").value == 12000
    assert _by_id(q, "inverter").kind == CriterionKind.DESEJAVEL


def test_celular():
    q = interpret("Smartphone com boa câmera, 256 GB e bateria de longa duração")
    assert q.category == "celular"
    assert _by_id(q, "armazenamento").value == 256
    assert _by_id(q, "camera") is not None
    assert _by_id(q, "bateria") is not None


def test_preco_formato_brasileiro():
    q = interpret("tv 55 polegadas ate 3.500,00")
    assert q.max_price == 3500.0


def test_categoria_desconhecida():
    q = interpret("furadeira de impacto 700W")
    assert q.category == "geral"
    assert q.notes  # aviso de categoria nao identificada
