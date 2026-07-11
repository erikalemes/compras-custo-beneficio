import { describe, expect, it } from "vitest";
import { fmtSpecValue } from "@/lib/pdf";

describe("fmtSpecValue", () => {
  it("traduz booleanos", () => {
    expect(fmtSpecValue(true)).toBe("Sim");
    expect(fmtSpecValue(false)).toBe("Não");
  });
  it("trata vazios", () => {
    expect(fmtSpecValue(null)).toBe("—");
    expect(fmtSpecValue(undefined)).toBe("—");
    expect(fmtSpecValue("")).toBe("—");
  });
  it("converte numeros e textos", () => {
    expect(fmtSpecValue(256)).toBe("256");
    expect(fmtSpecValue("inox")).toBe("inox");
  });
});
