// Tabela comparativa em PDF (jspdf + autotable), gerada no navegador.
// Funciona igual no modo completo (backend) e na demo estatica do GitHub Pages.
import { APP_NAME } from "./config";
import { formatBRL, reputationText } from "./format";
import type { RankedOffer, SearchResults } from "./types";
import { LABEL_NAMES } from "./types";

const BRAND: [number, number, number] = [29, 78, 216];

export function fmtSpecValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function warrantyText(o: RankedOffer["offer"]): string {
  return `${o.warranty.kind.replace(/_/g, " ")} · ${o.warranty.months}m`;
}

function installmentsText(o: RankedOffer["offer"]): string {
  if (o.installments_count > 0 && o.installments_interest_free)
    return `${o.installments_count}x de ${formatBRL(o.installment_value)} s/ juros`;
  return "—";
}

function mainRow(r: RankedOffer, validated: boolean): string[] {
  const o = r.offer;
  const b = r.price_breakdown;
  const labels = r.labels.map((l) => LABEL_NAMES[l] ?? l).join(", ");
  return [
    o.product_name,
    `${o.store}${o.seller_name && o.seller_name !== o.store ? `\nVend.: ${o.seller_name}` : ""}`,
    formatBRL(b.total_delivered),
    formatBRL(b.price_pix),
    installmentsText(o),
    b.shipping > 0 ? formatBRL(b.shipping) : "Grátis",
    b.cashback_later > 0 ? `${formatBRL(b.cashback_later)} (posterior)` : "—",
    `${o.reviews.average.toFixed(1)} (${o.reviews.count})`,
    reputationText(o.store_reputation.classification),
    warrantyText(o),
    validated ? r.score.toFixed(1) : "—",
    validated ? labels || "—" : "Não validada para o CEP",
  ];
}

export async function exportPdf(results: SearchResults): Promise<void> {
  const doc = await buildPdf(results);
  doc.save(`comparativo-${results.search_id}.pdf`);
}

export async function buildPdf(results: SearchResults): Promise<import("jspdf").jsPDF> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date().toLocaleString("pt-BR");

  doc.setFontSize(14);
  doc.setTextColor(...BRAND);
  doc.text(`${APP_NAME} — Tabela comparativa`, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`Pesquisa: "${results.query.original_text}"`, 14, 21);
  doc.text(
    `Entrega para: ${results.cep.cep} (${results.cep.city}/${results.cep.state}) · Gerado em ${now}` +
      ` · ${results.offers.length} oferta(s) válida(s)`,
    14, 26,
  );
  if (results.mode === "demo") {
    doc.setTextColor(180, 83, 9);
    doc.text(
      "Modo demonstração: preços, avaliações e reputações são fictícios, apenas para demonstrar a aplicação.",
      14, 31,
    );
  }

  const head = [[
    "Modelo", "Loja / Vendedor", "Preço total entregue", "Preço no Pix", "Parcelamento",
    "Frete", "Cashback", "Avaliação", "Reputação", "Garantia", "Nota", "Classificações",
  ]];
  const body = [
    ...results.offers.map((r) => mainRow(r, true)),
    ...results.unvalidated_offers.map((r) => mainRow(r, false)),
  ];
  autoTable(doc, {
    head,
    body: body.length ? body : [["Nenhuma oferta encontrada para os critérios informados.", "", "", "", "", "", "", "", "", "", "", ""]],
    startY: results.mode === "demo" ? 35 : 30,
    styles: { fontSize: 7, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: { fillColor: BRAND, fontSize: 7 },
    columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 34 }, 11: { cellWidth: 34 } },
  });

  // Especificações tecnicas: linhas = caracteristicas, colunas = modelos
  const specOffers = results.offers.slice(0, 6);
  if (specOffers.length > 0) {
    const keys = Array.from(new Set(specOffers.flatMap((r) => Object.keys(r.offer.specs)))).slice(0, 14);
    if (keys.length > 0) {
      // eslint-disable-next-line
      const lastY = (doc as any).lastAutoTable?.finalY ?? 40;
      doc.setFontSize(11);
      doc.setTextColor(...BRAND);
      doc.text("Especificações técnicas", 14, lastY + 9);
      autoTable(doc, {
        head: [["Característica", ...specOffers.map((r) => `${r.offer.brand} ${r.offer.model}`)]],
        body: keys.map((k) => [
          k.replace(/_/g, " "),
          ...specOffers.map((r) => fmtSpecValue(r.offer.specs[k])),
        ]),
        startY: lastY + 12,
        styles: { fontSize: 7, cellPadding: 1.6, overflow: "linebreak" },
        headStyles: { fillColor: BRAND, fontSize: 7 },
      });
    }
  }

  // Alertas
  const alertRows = [...results.offers, ...results.unvalidated_offers].flatMap((r) =>
    r.alerts.map((a) => [r.offer.product_name, a]),
  );
  if (alertRows.length > 0) {
    // eslint-disable-next-line
    const lastY = (doc as any).lastAutoTable?.finalY ?? 40;
    doc.setFontSize(11);
    doc.setTextColor(...BRAND);
    doc.text("Alertas", 14, lastY + 9);
    autoTable(doc, {
      head: [["Produto", "Alerta"]],
      body: alertRows,
      startY: lastY + 12,
      styles: { fontSize: 7, cellPadding: 1.6, overflow: "linebreak" },
      headStyles: { fillColor: [180, 83, 9], fontSize: 7 },
      columnStyles: { 0: { cellWidth: 70 } },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      "Preços e ofertas podem mudar; confirme na loja antes de comprar. Classificação informativa, não é recomendação de compra.",
      14, doc.internal.pageSize.getHeight() - 6,
    );
  }

  return doc;
}
