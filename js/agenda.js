// Utilitários: limpeza de texto, datas no fuso do Brasil, disponibilidade de horários e fetch com timeout.
function sanitizarInput(str) {
  if (!str) return "";
  return str.toString().trim()
    .replace(/[<>]/g, "")
    .replace(/^[=+\-@]+/, "");
}

function obterDataHojeBrasil() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return ano + "-" + mes + "-" + dia;
}

function obterDataMaximaBrasil() {
  const limite = new Date();
  limite.setDate(limite.getDate() + DIAS_MAXIMOS_AGENDAMENTO);
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
  const hojeStr = obterDataHojeBrasil();
  if (dataEscolhida !== hojeStr) return false;

  const agora = new Date();
  const partesHora = horarioStr.split(':');
  const horaSlot = Number(partesHora[0]);
  const minSlot = Number(partesHora[1]);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const minutosSlot = horaSlot * 60 + minSlot;

  return minutosSlot <= (minutosAgora + 15);
}

function diaPossuiVagaDisponivel(dataStr) {
  if (!dataStr) return false;
  const partes = dataStr.split('-').map(Number);
  if (partes.length !== 3 || partes[0] < 2026) return false;

  const dt = new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0);
  const diaSemana = dt.getDay();
  if (diaSemana === 0 || diaSemana === 6) return false;
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
    horarioJaPassouHoje(dataStr, horario);
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
