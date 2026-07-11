// Exportacao .xlsx no navegador (exceljs), com as mesmas 4 abas do backend.
import type { RankedOffer, SearchResults } from "../types";
import { LABEL_NAMES } from "../types";

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1D4ED8" } };
const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true };
const MONEY = 'R$ #,##0.00';

export async function exportXlsxStatic(results: SearchResults): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const now = new Date().toLocaleString("pt-BR");

  // ------------------------------------------------------------ Aba 1
  const ws = wb.addWorksheet("Comparativo");
  const headers = [
    "Classificação", "Produto", "Marca", "Modelo", "Categoria", "Especificações",
    "Obrigatórios atendidos", "Obrigatórios não atendidos", "Desejáveis atendidos",
    "Loja", "Marketplace", "Vendedor", "Origem", "Condição",
    "Preço normal", "Preço no Pix", "Parcelas s/ juros", "Valor da parcela",
    "Frete", "Impostos", "Taxas", "Cupom", "Cashback", "Preço total imediato",
    "Prazo (dias)", "Entrega confirmada", "Avaliação", "Qtd. avaliações",
    "Reputação loja", "Reputação vendedor", "Garantia", "Nota custo-benefício",
    "Vantagens", "Desvantagens", "Alertas", "Link", "Fonte", "Consultado em",
  ];
  ws.addRow(headers);
  const rows: [RankedOffer, boolean][] = [
    ...results.offers.map((r): [RankedOffer, boolean] => [r, true]),
    ...results.unvalidated_offers.map((r): [RankedOffer, boolean] => [r, false]),
  ];
  const moneyCols = [15, 16, 18, 19, 20, 21, 22, 23, 24];
  for (const [r, validated] of rows) {
    const o = r.offer;
    const b = r.price_breakdown;
    const labels =
      r.labels.map((l) => LABEL_NAMES[l] ?? l).join(", ") ||
      (validated ? "" : "Oferta não validada para o CEP informado");
    const specs = Object.entries(o.specs).map(([k, v]) => `${k}: ${v}`).join("; ");
    const row = ws.addRow([
      labels, o.product_name, o.brand, o.model, o.category, specs,
      r.mandatory_met.join("; "), r.mandatory_unmet.join("; "), r.desirable_met.join("; "),
      o.store, o.marketplace, o.seller_name, o.origin, o.condition,
      b.price, b.price_pix, o.installments_interest_free ? o.installments_count : 0,
      o.installment_value, b.shipping, b.taxes, b.fees, b.coupon_discount, b.cashback_later,
      b.total_delivered, o.shipping_days ?? "", validated ? "Sim" : "Não confirmada",
      o.reviews.average, o.reviews.count,
      o.store_reputation.classification.replace(/_/g, " "),
      o.seller_reputation.classification.replace(/_/g, " "),
      `${o.warranty.kind.replace(/_/g, " ")} (${o.warranty.months} meses)`,
      r.score, r.advantages.join("; "), r.disadvantages.join("; "), r.alerts.join("; "),
      o.url, o.source, now,
    ]);
    for (const c of moneyCols) row.getCell(c).numFmt = MONEY;
    if (o.url) row.getCell(36).value = { text: o.url, hyperlink: o.url };
  }
  styleSheet(ws, headers.length);

  // ------------------------------------------------------------ Aba 2
  const ws2 = wb.addWorksheet("Histórico de preços");
  ws2.addRow([
    "Produto", "Marca", "Modelo", "Loja", "Vendedor", "Data", "Preço total",
    "Cupom", "Cashback", "Disponibilidade", "CEP consultado",
  ]);
  const cepMasked = results.cep.cep.slice(0, 2) + "***-***";
  for (const r of results.offers) {
    for (const point of r.history.series) {
      const row = ws2.addRow([
        r.offer.product_name, r.offer.brand, r.offer.model, r.offer.store, r.offer.seller_name,
        point.date, point.total_price, r.price_breakdown.coupon_discount,
        r.price_breakdown.cashback_later, "Sim", cepMasked,
      ]);
      for (const c of [7, 8, 9]) row.getCell(c).numFmt = MONEY;
    }
  }
  styleSheet(ws2, 11);

  // ------------------------------------------------------------ Aba 3
  const ws3 = wb.addWorksheet("Critérios da pesquisa");
  const q = results.query;
  const kindMap: Record<string, string> = {
    obrigatorio: "Obrigatório", desejavel: "Desejável", indiferente: "Indiferente",
  };
  const meta: [string, string][] = [
    ["Descrição original", q.original_text],
    ["CEP", results.cep.cep],
    ["Cidade", results.cep.city],
    ["Estado", results.cep.state],
    ["Preço máximo", q.max_price ? `R$ ${q.max_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "não informado"],
    ["Importados permitidos", q.allow_imported ? "Sim" : "Não"],
    ["Tolerância aplicada", `${(q.tolerance * 100).toFixed(0)}%`],
    ["Data e hora", now],
    ["", ""],
    ["Critério", "Tipo"],
  ];
  for (const [a, b] of meta) ws3.addRow([a, b]);
  for (const c of q.criteria) ws3.addRow([c.label, kindMap[c.kind] ?? c.kind]);
  ws3.getColumn(1).width = 32;
  ws3.getColumn(2).width = 70;
  ws3.getColumn(1).font = { bold: true };

  // ------------------------------------------------------------ Aba 4
  const ws4 = wb.addWorksheet("Fontes e alertas");
  ws4.addRow(["Fonte", "Tipo", "Simulada", "Status", "Ofertas", "Descartadas", "Observações", "Acesso em"]);
  for (const s of results.sources)
    ws4.addRow([s.name, s.kind, s.simulated ? "Sim" : "Não", s.status, s.offers_found, s.offers_discarded, s.message, now]);
  ws4.addRow([]);
  ws4.addRow(["Alertas por oferta"]);
  for (const r of [...results.offers, ...results.unvalidated_offers])
    for (const alert of r.alerts) ws4.addRow([r.offer.product_name, r.offer.store, "", "", "", "", alert]);
  styleSheet(ws4, 8);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comparativo-${results.search_id}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function styleSheet(ws: import("exceljs").Worksheet, ncols: number): void {
  const header = ws.getRow(1);
  for (let c = 1; c <= ncols; c++) {
    const cell = header.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", wrapText: true };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(ws.rowCount, 2), column: ncols } };
  for (let c = 1; c <= ncols; c++) {
    let width = 10;
    ws.getColumn(c).eachCell({ includeEmpty: false }, (cell: { value: unknown }) => {
      width = Math.max(width, String(cell.value ?? "").length + 2);
    });
    ws.getColumn(c).width = Math.min(width, 45);
  }
}
