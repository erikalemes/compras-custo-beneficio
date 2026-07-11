import { APP_NAME } from "@/lib/config";

export const metadata = { title: `Sobre e metodologia — ${APP_NAME}` };

export default function SobrePage() {
  return (
    <article className="prose-slate mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Sobre e metodologia</h1>
      </header>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">Como o ranking funciona</h2>
        <p className="text-sm text-slate-700">
          Cada oferta recebe uma nota de 0 a 100, calculada de forma transparente a partir de sete
          componentes com pesos configuráveis:
        </p>
        <ul className="list-inside list-disc text-sm text-slate-700">
          <li>Preço total entregue (produto + frete + impostos + taxas − Pix − cupom válido): 30%</li>
          <li>Avaliações do produto (nota média ponderada pela quantidade): 20%</li>
          <li>Reputação da loja e do vendedor: 15%</li>
          <li>Especificações e qualidade (critérios desejáveis atendidos): 15%</li>
          <li>Histórico de preços (preço atual vs. últimos 6 meses): 10%</li>
          <li>Garantia e pós-venda: 5%</li>
          <li>Disponibilidade e condições comerciais: 5%</li>
        </ul>
        <p className="text-sm text-slate-700">
          O prazo de entrega é informativo e tem peso zero, mas prazos extremos ou indefinidos geram alerta.
          O cashback nunca é abatido do preço imediato; aparece como benefício posterior. A justificativa
          completa de cada nota pode ser vista em “Ver detalhes” em cada oferta.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">Fontes consultadas</h2>
        <p className="text-sm text-slate-700">
          A arquitetura usa adaptadores por fonte. A Amazon é consultada em toda pesquisa (via catálogo
          simulado quando não há credenciais da Product Advertising API). No modo de APIs públicas, o
          Mercado Livre é consultado pela API aberta. Fontes fictícias de demonstração (MegaLoja Brasil e
          ImportaDireto) permitem testar tudo sem chaves. Nenhum mecanismo contorna CAPTCHA, autenticação ou
          bloqueios técnicos; coleta automatizada só é feita quando permitida pelos termos de uso.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">Limitações</h2>
        <ul className="list-inside list-disc text-sm text-slate-700">
          <li>Preços e ofertas mudam rápido; confirme tudo na loja antes de comprar.</li>
          <li>No modo demonstração, todos os dados são fictícios e claramente sinalizados.</li>
          <li>O histórico de preços real é construído a partir das pesquisas; não inventamos dados passados.</li>
          <li>Frete e prazo dependem de cotação da loja; quando não confirmados, a oferta fica fora do ranking.</li>
          <li>A nota é informativa, não é recomendação de compra nem aconselhamento financeiro.</li>
        </ul>
      </section>

      <section className="card space-y-2" id="privacidade">
        <h2 className="text-lg font-semibold">Privacidade</h2>
        <ul className="list-inside list-disc text-sm text-slate-700">
          <li>Não há cadastro nem login; não coletamos dados pessoais.</li>
          <li>O CEP é usado apenas para validar entrega e frete e é mascarado nos logs do servidor.</li>
          <li>O CEP só é salvo no seu navegador se você marcar “Salvar meu CEP neste navegador”.</li>
          <li>Favoritos e histórico ficam no IndexedDB do seu navegador; apague-os quando quiser em Favoritos.</li>
          <li>Não há telemetria invasiva; nenhum dado local é enviado ao GitHub ou a terceiros.</li>
          <li>Links de ofertas levam a sites externos, que seguem políticas próprias.</li>
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">Links de afiliados</h2>
        <p className="text-sm text-slate-700">
          Esta versão não usa links de afiliados. Se um dia forem usados, serão claramente identificados e
          documentados nesta página, sem alterar o ranking.
        </p>
      </section>
    </article>
  );
}
