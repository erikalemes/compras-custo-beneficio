import { describe, expect, it } from "vitest";
import { formatBRL, historyClassText, isValidCep, maskCepInput, reputationText } from "@/lib/format";

describe("isValidCep", () => {
  it("aceita formatos validos", () => {
    expect(isValidCep("74000-000")).toBe(true);
    expect(isValidCep("74000000")).toBe(true);
  });
  it("rejeita formatos invalidos", () => {
    expect(isValidCep("7400-000")).toBe(false);
    expect(isValidCep("abc")).toBe(false);
    expect(isValidCep("")).toBe(false);
  });
});

describe("maskCepInput", () => {
  it("formata conforme digita", () => {
    expect(maskCepInput("74000000")).toBe("74000-000");
    expect(maskCepInput("74")).toBe("74");
    expect(maskCepInput("74000-0004444")).toBe("74000-000");
  });
});

describe("formatBRL", () => {
  it("formata em reais", () => {
    expect(formatBRL(4300)).toMatch(/4\.300,00/);
  });
  it("trata nulos", () => {
    expect(formatBRL(null)).toBe("—");
    expect(formatBRL(undefined)).toBe("—");
  });
});

describe("textos de classificacao", () => {
  it("traduz reputacao", () => {
    expect(reputationText("nao_localizada")).toBe("Não localizada");
  });
  it("traduz historico", () => {
    expect(historyClassText("na_media")).toBe("Dentro da média");
  });
});
