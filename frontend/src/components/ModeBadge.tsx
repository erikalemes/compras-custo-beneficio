"use client";

import { useEffect, useState } from "react";
import { getAppConfig } from "@/lib/api";

const MODE_LABEL: Record<string, string> = {
  demo: "Modo demonstração",
  public: "Modo APIs públicas",
  production: "Modo produção",
};

export function ModeBadge() {
  const [mode, setMode] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    getAppConfig()
      .then((cfg) => setMode(cfg.mode))
      .catch(() => setOffline(true));
  }, []);

  if (offline)
    return (
      <span className="badge bg-red-100 text-red-800" role="status">
        Backend indisponível
      </span>
    );
  if (!mode) return null;
  return (
    <span
      className={`badge ${mode === "demo" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
      role="status"
    >
      {MODE_LABEL[mode] ?? mode}
    </span>
  );
}
