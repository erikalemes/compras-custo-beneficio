// Dois alvos de build:
// - padrao: app completo com backend (output standalone, para Docker/Vercel);
// - NEXT_PUBLIC_STATIC_DEMO=true: demonstracao 100% estatica para GitHub Pages
//   (output export + basePath do repositorio).
const staticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
const basePath = staticDemo ? process.env.PAGES_BASE_PATH ?? "/compras-custo-beneficio" : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: staticDemo ? "export" : "standalone",
  ...(basePath ? { basePath } : {}),
  images: { unoptimized: true },
};

export default nextConfig;
