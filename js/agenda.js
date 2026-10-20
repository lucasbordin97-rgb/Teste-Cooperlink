// Utilitários: limpeza de texto, datas no fuso do Brasil, disponibilidade de horários e fetch com timeout.
function sanitizarInput(str) {
  if (!str) return "";
  return str.toString().trim()
    .replace(/[<>]/g, "")
    .replace(/^[=+\-@]+/, "");
}

// Escapa texto que vem de fora (ex.: cidade devolvida pelo viaCEP) antes de ir para innerHTML.
function escaparHtml(str) {
  return String(str === null || str === undefined ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Data e hora em Brasília, qualquer que seja o fuso ou o relógio do aparelho.
function agoraEmBrasilia() {
  const p = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).forEach(function(x) { p[x.type] = x.value; });
  return { data: p.year + "-" + p.month + "-" + p.day, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

function obterDataHojeBrasil() {
  return agoraEmBrasilia().data;
}

function obterDataMaximaBrasil() {
  const base = agoraEmBrasilia().data.split('-').map(Number);
  const limite = new Date(base[0], base[1] - 1, base[2] + DIAS_MAXIMOS_AGENDAMENTO, 12, 0, 0);
  const mes = String(limite.getMonth() + 1).padStart(2, '0');
  const dia = String(limite.getDate()).padStart(2, '0');
  return limite.getFullYear() + "-" + mes + "-" + dia;
}

function formatarDataBR(dataYYYYMMDD) {
  if (!dataYYYYMMDD) return "";
  const partes = dataYYYYMMDD.split('-');
  if (partes.length !== 3) return dataYYYYMMDD;
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function horarioJaPassouHoje(dataEscolhida, horarioStr) {
  const agora = agoraEmBrasilia();
  if (dataEscolhida !== agora.data) return false;

  const partesHora = horarioStr.split(':');
  const minutosSlot = Number(partesHora[0]) * 60 + Number(partesHora[1]);

  return minutosSlot <= (agora.minutos + 15);
}

function diaPossuiVagaDisponivel(dataStr) {
  if (!dataStr) return false;
  const partes = dataStr.split('-').map(Number);
  if (partes.length !== 3 || partes[0] < 2026) return false;

  const dt = new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0);
  const diaSemana = dt.getDay();
  if (diaSemana === 0 || diaSemana === 6) return false;
  if (nomeDoFeriado(dataStr, nomePostoAtual())) return false;
  if (dataStr > obterDataMaximaBrasil()) return false;

  const reservasLocais = lerReservasLocais();
  return todosHorarios.some(function(horario) {
    return !horarioIndisponivel(dataStr, horario, reservasLocais);
  });
}

function nomePostoAtual() {
  return (estadoAgendamento.posto && estadoAgendamento.posto.nome) || POSTO_HENRICAR.nome;
}

// Uma vaga ocupada em outro posto não bloqueia este. Vaga sem posto (versão
// antiga da planilha) ou de posto desconhecido bloqueia por segurança.
function vagaBloqueiaPosto(vaga, postoAtual) {
  return !vaga.posto || vaga.posto === postoAtual || POSTOS_COM_AGENDA.indexOf(vaga.posto) === -1;
}

function horarioIndisponivel(dataStr, horario, reservasLocais) {
  const postoAtual = nomePostoAtual();
  const mesmoHorario = function(vaga) {
    return vaga && vaga.data === dataStr && vaga.horario === horario && vagaBloqueiaPosto(vaga, postoAtual);
  };
  return slotsOcupadosNaNuvem.some(mesmoHorario) ||
    (reservasLocais || lerReservasLocais()).some(mesmoHorario) ||
    horarioJaPassouHoje(dataStr, horario) ||
    !!nomeDoFeriado(dataStr, postoAtual);
}

function encontrarProximoDiaDisponivel(dataBaseStr) {
  const base = dataBaseStr || obterDataHojeBrasil();
  const partes = base.split('-').map(Number);
  const dt = new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0);

  for (let tentativa = 0; tentativa < 45; tentativa++) {
    const a = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const dataCandidata = a + "-" + m + "-" + d;

    if (diaPossuiVagaDisponivel(dataCandidata)) {
      return dataCandidata;
    }
    dt.setDate(dt.getDate() + 1);
  }
  return base;
}

function definirDataMinimaLocal() {
  const hoje = obterDataHojeBrasil();
  const diaInicial = encontrarProximoDiaDisponivel(hoje);
  const elem = document.getElementById('dataAgendamento');
  if (elem) {
    elem.min = hoje;
    elem.max = obterDataMaximaBrasil();
    elem.value = diaInicial;
  }
  estadoAgendamento.data = diaInicial;
}

async function fetchComTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(function() { controller.abort(); }, timeoutMs || 9000);
  try {
    const opts = Object.assign({}, options || {}, { signal: controller.signal });
    const response = await fetch(url, opts);
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ---- Dias úteis: segunda a sexta, sem feriado nacional nem ponto facultativo (prazo do técnico parceiro) ----
function msDeISO(iso) {
  const p = iso.split('-').map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]);
}

function ehDiaUtilGeral(iso) {
  const dow = new Date(msDeISO(iso)).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !(FERIADOS_FIXOS[iso.slice(5)] || feriadosMoveis(Number(iso.slice(0, 4)))[iso]);
}

// Primeiro dia útil DEPOIS da data informada.
function proximoDiaUtil(iso) {
  let ms = msDeISO(iso);
  do { ms += 86400000; } while (!ehDiaUtilGeral(dataISOdeUTC(ms)));
  return dataISOdeUTC(ms);
}

// Prazo do técnico: começa no primeiro dia útil depois de hoje e vai até o 5º dia útil (contando o primeiro).
function prazoTecnico(hojeISO) {
  const inicio = proximoDiaUtil(hojeISO);
  let fim = inicio;
  for (let i = 1; i < 5; i++) fim = proximoDiaUtil(fim);
  return { inicio: inicio, fim: fim };
}

function rotuloDiaCurto(iso) {
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  return dias[new Date(msDeISO(iso)).getUTCDay()] + ", " + iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

function textoPrazoTecnico(hojeISO) {
  const p = prazoTecnico(hojeISO);
  return "Um técnico parceiro da Cooperlink entrará em contato com você em até 5 dias úteis (de " + rotuloDiaCurto(p.inicio) +
    " a " + rotuloDiaCurto(p.fim) + ") para combinar a melhor data e horário.";
}
