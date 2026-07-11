import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { APP_NAME } from "@/lib/config";
import { ModeBadge } from "@/components/ModeBadge";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Comparador aberto de custo-benefício: pesquise um produto em linguagem natural e veja as melhores ofertas com entrega para o seu CEP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
        >
          Pular para o conteúdo
        </a>
        <header className="border-b border-slate-200 bg-white">
          <nav
            aria-label="Navegação principal"
            className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
          >
            <Link href="/" className="text-lg font-bold text-brand-700">
              {APP_NAME}
            </Link>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link href="/" className="hover:text-brand-700">
                Pesquisar
              </Link>
              <Link href="/favoritos" className="hover:text-brand-700">
                Favoritos e histórico
              </Link>
              <Link href="/sobre" className="hover:text-brand-700">
                Sobre e metodologia
              </Link>
            </div>
            <span className="ml-auto">
              <ModeBadge />
            </span>
          </nav>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          <p>
            {APP_NAME} é um projeto de código aberto. Preços e ofertas podem mudar; confirme as condições na
            loja antes de comprar. A classificação é informativa e não constitui recomendação de compra.
          </p>
        </footer>
      </body>
    </html>
  );
}
