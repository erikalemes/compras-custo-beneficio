// Validacao de CEP offline (porta de backend/app/services/cep.py).
import type { CepInfo } from "../types";

const STATE_BY_PREFIX: [number, number, string][] = [
  [1, 19, "SP"], [20, 28, "RJ"], [29, 29, "ES"], [30, 39, "MG"],
  [40, 48, "BA"], [49, 49, "SE"], [50, 56, "PE"], [57, 57, "AL"],
  [58, 58, "PB"], [59, 59, "RN"], [60, 63, "CE"], [64, 64, "PI"],
  [65, 65, "MA"], [66, 68, "PA"], [69, 69, "AM"], [70, 73, "DF"],
  [74, 76, "GO"], [77, 77, "TO"], [78, 78, "MT"], [79, 79, "MS"],
  [80, 87, "PR"], [88, 89, "SC"], [90, 99, "RS"],
];

const CITY_BY_PREFIX: Record<string, string> = {
  "01": "São Paulo", "02": "São Paulo", "03": "São Paulo", "04": "São Paulo", "05": "São Paulo",
  "08": "São Paulo", "13": "Campinas", "20": "Rio de Janeiro", "21": "Rio de Janeiro",
  "22": "Rio de Janeiro", "23": "Rio de Janeiro", "29": "Vitória", "30": "Belo Horizonte",
  "31": "Belo Horizonte", "40": "Salvador", "41": "Salvador", "50": "Recife", "51": "Recife",
  "52": "Recife", "57": "Maceió", "58": "João Pessoa", "59": "Natal", "60": "Fortaleza",
  "64": "Teresina", "65": "São Luís", "66": "Belém", "69": "Manaus", "70": "Brasília",
  "71": "Brasília", "72": "Brasília", "74": "Goiânia", "77": "Palmas", "78": "Cuiabá",
  "79": "Campo Grande", "80": "Curitiba", "81": "Curitiba", "82": "Curitiba",
  "88": "Florianópolis", "90": "Porto Alegre", "91": "Porto Alegre",
};

export function lookupCepStatic(raw: string): CepInfo {
  const m = raw.trim().match(/^(\d{5})-?(\d{3})$/);
  if (!m) return { cep: raw, valid: false, city: "", state: "", message: "Formato inválido. Use 00000-000." };
  const cep = `${m[1]}-${m[2]}`;
  const prefix2 = parseInt(cep.slice(0, 2), 10);
  const state = STATE_BY_PREFIX.find(([lo, hi]) => prefix2 >= lo && prefix2 <= hi)?.[2] ?? "";
  if (!state)
    return { cep, valid: false, city: "", state: "", message: "CEP fora das faixas brasileiras conhecidas." };
  const city = CITY_BY_PREFIX[cep.slice(0, 2)] ?? "";
  return {
    cep,
    valid: true,
    city,
    state,
    message: city ? "" : "Cidade não identificada na base offline; confira o estado.",
  };
}
