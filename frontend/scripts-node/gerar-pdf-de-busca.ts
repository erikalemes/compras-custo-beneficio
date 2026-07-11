// Gera a tabela comparativa em PDF a partir de uma pesquisa JA EXECUTADA no
// backend (real ou demo), com o mesmo layout do botao da interface.
// Uso: npx tsx scripts-node/gerar-pdf-de-busca.ts <search_id> <saida.pdf> [api_url]
import { writeFileSync } from "node:fs";
import { buildPdf } from "../src/lib/pdf";
import type { SearchResults } from "../src/lib/types";

async function main() {
  const [searchId, saida, apiUrl = "http://localhost:8000"] = process.argv.slice(2);
  if (!searchId || !saida) {
    console.error("Uso: npx tsx scripts-node/gerar-pdf-de-busca.ts <search_id> <saida.pdf> [api_url]");
    process.exit(1);
  }
  const resp = await fetch(`${apiUrl}/api/search/${searchId}`);
  if (!resp.ok) {
    console.error(`Erro ao buscar a pesquisa: HTTP ${resp.status}`);
    process.exit(1);
  }
  const results = (await resp.json()) as SearchResults;
  const doc = await buildPdf(results);
  writeFileSync(saida, Buffer.from(doc.output("arraybuffer")));
  console.log(
    `PDF gerado: ${saida} (${results.offers.length} ofertas válidas, ` +
      `${results.unvalidated_offers.length} não validadas, modo ${results.mode})`,
  );
}

main();
