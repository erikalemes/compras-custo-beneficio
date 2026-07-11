export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function isValidCep(cep: string): boolean {
  return /^\d{5}-?\d{3}$/.test(cep.trim());
}

export function maskCepInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function reputationText(classification: string): string {
  const map: Record<string, string> = {
    excelente: "Excelente",
    boa: "Boa",
    regular: "Regular",
    ruim: "Ruim",
    critica: "Crítica",
    insuficiente: "Insuficiente",
    nao_localizada: "Não localizada",
  };
  return map[classification] ?? classification;
}

export function historyClassText(classification: string): string {
  const map: Record<string, string> = {
    muito_baixo: "Muito baixo",
    baixo: "Baixo",
    na_media: "Dentro da média",
    alto: "Alto",
    muito_alto: "Muito alto",
    insuficiente: "Histórico insuficiente",
  };
  return map[classification] ?? classification;
}
