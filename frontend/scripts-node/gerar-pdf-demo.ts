// Gera a tabela comparativa em PDF pela linha de comando (modo demo), usando
// exatamente o mesmo motor e o mesmo layout do botao "Tabela comparativa (PDF)".
// Uso: npx tsx scripts-node/gerar-pdf-demo.ts "<pesquisa>" <cep> <arquivo-saida.pdf>
import { writeFileSync } from "node:fs";
import { lookupCepStatic } from "../src/lib/demo/cep";
import { runSearchStatic } from "../src/lib/demo/engine";
import { interpretStatic } from "../src/lib/demo/interpreter";
import { buildPdf } from "../src/lib/pdf";

async function main() {
  const [texto, cep, saida] = process.argv.slice(2);
  if (!texto || !cep || !saida) {
    console.error('Uso: npx tsx scripts-node/gerar-pdf-demo.ts "<pesquisa>" <cep> <saida.pdf>');
    process.exit(1);
  }
  const cepInfo = lookupCepStatic(cep);
  if (!cepInfo.valid) {
    console.error(`CEP inválido: ${cepInfo.message}`);
    process.exit(1);
  }
  const query = interpretStatic(texto);
  const results = runSearchStatic(query, cepInfo);
  results.search_id = "cli";
  const doc = await buildPdf(results);
  writeFileSync(saida, Buffer.from(doc.output("arraybuffer")));
  console.log(
    `PDF gerado: ${saida} (${results.offers.length} ofertas válidas, ` +
      `${results.unvalidated_offers.length} não validadas)`,
  );
}

main();
