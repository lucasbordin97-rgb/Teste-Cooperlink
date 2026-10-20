// Dias sem atendimento: feriados nacionais, estaduais (por UF), pontos facultativos, feriados da cidade de cada
// posto e fechamentos avulsos. A mesma regra existe no Apps Script (apps-script-v3.2.gs): mudou aqui, mude lá.
// Datas fixas em "MM-DD". Para fechar um posto num dia só, use FECHAMENTOS_AVULSOS com "AAAA-MM-DD".
const FERIADOS_FIXOS = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Consciência Negra",
  "12-25": "Natal"
};

// Feriados ESTADUAIS, por UF (a UF do posto vem do próprio nome: "..., Cidade/UF (CEP ...)").
// Só entram feriados do estado inteiro. Conferido em 20/10/2026 (fontes no commit): PR, MG e MT não têm feriado
// estadual; SC tem a Data Magna (11/08), que a Lei 18.531/2022 transfere para o domingo seguinte, então não cai em dia útil.
const FERIADOS_ESTADUAIS = {
  SP: { "07-09": "Revolução Constitucionalista (feriado estadual)" },
  BA: { "06-24": "São João (feriado estadual)", "07-02": "Independência da Bahia (feriado estadual)" }
};

// Feriados da cidade de cada posto (ids de POSTOS em config.js; "henricar" é Campinas).
const FERIADOS_MUNICIPAIS = {
  henricar: { "07-14": "Aniversário de Campinas" },
  h7: { "01-25": "Aniversário de São Paulo" },
  la: { "01-25": "Aniversário de São Paulo" },
  fl: { "01-25": "Aniversário de São Paulo" },
  ho: { "01-25": "Aniversário de São Paulo" },
  jp: { "01-25": "Aniversário de São Paulo" },
  ca: { "03-26": "Emancipação de Carapicuíba" },
  ar: { "06-08": "Aniversário de Arujá", "08-06": "Dia do Padroeiro de Arujá" },
  st: { "12-08": "Aniversário de Mauá" },
  gc: { "08-20": "Aniversário de São Bernardo do Campo" },
  ex: { "01-20": "Dia de São Sebastião (Suzano)" }
};

// Fechamentos avulsos por posto, ex.: { h7: { "2026-12-24": "Inventário" } }
const FECHAMENTOS_AVULSOS = {};

function dataISOdeUTC(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}

// Domingo de Páscoa (calendário gregoriano), em ms UTC.
function pascoaEmMs(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

const feriadosMoveisPorAno = {};
function feriadosMoveis(ano) {
  if (!feriadosMoveisPorAno[ano]) {
    const dia = 86400000, p = pascoaEmMs(ano), r = {};
    r[dataISOdeUTC(p - 48 * dia)] = "Carnaval (ponto facultativo)";
    r[dataISOdeUTC(p - 47 * dia)] = "Carnaval (ponto facultativo)";
    r[dataISOdeUTC(p - 2 * dia)] = "Sexta-feira Santa";
    r[dataISOdeUTC(p + 60 * dia)] = "Corpus Christi (ponto facultativo)";
    feriadosMoveisPorAno[ano] = r;
  }
  return feriadosMoveisPorAno[ano];
}

// UF do posto, lida do nome ("... Campinas/SP (CEP 13010-140)"). Nome desconhecido: SP, que é o caso mais comum.
function ufDoPosto(nomePosto) {
  const m = /\/([A-Z]{2}) \(CEP \d{5}-\d{3}\)\s*$/.exec(String(nomePosto || ""));
  return m ? m[1] : "SP";
}

function idDoPosto(nomePosto) {
  if (nomePosto === POSTO_HENRICAR.nome) return "henricar";
  const ids = Object.keys(POSTOS);
  for (let i = 0; i < ids.length; i++) if (POSTOS[ids[i]].nome === nomePosto) return ids[i];
  return null;
}

// Devolve o motivo do dia sem atendimento naquele posto, ou null se o dia é normal.
function nomeDoFeriado(dataISO, nomePosto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO || "")) return null;
  const id = idDoPosto(nomePosto), mmdd = dataISO.slice(5);
  return FERIADOS_FIXOS[mmdd] ||
    feriadosMoveis(Number(dataISO.slice(0, 4)))[dataISO] ||
    (FERIADOS_ESTADUAIS[ufDoPosto(nomePosto)] && FERIADOS_ESTADUAIS[ufDoPosto(nomePosto)][mmdd]) ||
    (id && FERIADOS_MUNICIPAIS[id] && FERIADOS_MUNICIPAIS[id][mmdd]) ||
    (id && FECHAMENTOS_AVULSOS[id] && FECHAMENTOS_AVULSOS[id][dataISO]) ||
    null;
}
