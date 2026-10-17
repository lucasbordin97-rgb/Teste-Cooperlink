// Escolha de data e horário: consulta à nuvem, salto automático de dia e grade de horários.
window.aoMudarDataManual = function() {
  const inputEl = document.getElementById('dataAgendamento');
  const inputData = inputEl ? inputEl.value : "";
  const avisoFds = document.getElementById('avisoFimDeSemana');
  const avisoAuto = document.getElementById('avisoAutoAvanco');
  const containerHorarios = document.getElementById('containerHorarios');

  if (!inputData) return;

  const partes = inputData.split('-').map(Number);
  if (partes.length !== 3 || partes[0] < 2026) return;

  const dataObj = new Date(partes[0], partes[1] - 1, partes[2], 12, 0, 0);
  const diaSemana = dataObj.getDay();

  const avisoJanela = document.getElementById('avisoDataForaJanela');
  avisoAuto.classList.add('hidden');
  avisoJanela.classList.add('hidden');

  if (inputData < obterDataHojeBrasil() || inputData > obterDataMaximaBrasil()) {
    avisoFds.classList.add('hidden');
    avisoJanela.classList.remove('hidden');
    containerHorarios.classList.add('hidden');
    return;
  }

  if (diaSemana === 0 || diaSemana === 6) {
    avisoFds.classList.remove('hidden');
    containerHorarios.classList.add('hidden');
    return;
  }

  avisoFds.classList.add('hidden');
  estadoAgendamento.data = inputData;
  dispararBuscaDeHorariosNaNuvem(false, true);
};

function verificarEAplicarSaltoAutomatico(dataOriginalSolicitada) {
  const inputEl = document.getElementById('dataAgendamento');
  const avisoAuto = document.getElementById('avisoAutoAvanco');
  const textoAuto = document.getElementById('textoAutoAvanco');
  const avisoFds = document.getElementById('avisoFimDeSemana');

  if (!diaPossuiVagaDisponivel(dataOriginalSolicitada)) {
    const proximoLivre = encontrarProximoDiaDisponivel(dataOriginalSolicitada);
    if (proximoLivre && proximoLivre !== dataOriginalSolicitada) {
      estadoAgendamento.data = proximoLivre;
      if (inputEl) inputEl.value = proximoLivre;
      if (avisoFds) avisoFds.classList.add('hidden');

      if (avisoAuto && textoAuto) {
        const hoje = obterDataHojeBrasil();
        const motivo = (dataOriginalSolicitada === hoje)
          ? "Os horários de hoje (" + formatarDataBR(dataOriginalSolicitada) + ") já encerraram ou estão completos."
          : "O dia " + formatarDataBR(dataOriginalSolicitada) + " já está com todos os horários completos.";
        
        textoAuto.innerHTML = motivo + " Avançamos automaticamente para o próximo dia disponível: <b>" + formatarDataBR(proximoLivre) + "</b>. <span class='text-slate-600 block mt-0.5'>Você pode selecionar qualquer outra data no calendário acima se preferir.</span>";
        avisoAuto.classList.remove('hidden');
      }
    }
  }
}

async function dispararBuscaDeHorariosNaNuvem(forcarRecarga, autoAvancarSeLotado) {
  const containerHorarios = document.getElementById('containerHorarios');
  const loading = document.getElementById('loadingSincronizacao');
  const dataSolicitada = estadoAgendamento.data || obterDataHojeBrasil();
  
  const agora = Date.now();
  if (!forcarRecarga && (agora - ultimaSincronizacao < 20000) && slotsOcupadosNaNuvem.length > 0) {
    if (autoAvancarSeLotado) {
      verificarEAplicarSaltoAutomatico(dataSolicitada);
    }
    containerHorarios.classList.remove('hidden');
    renderizarGradeHorarios();
    return;
  }

  containerHorarios.classList.add('hidden');
  loading.classList.remove('hidden');
  loading.classList.add('flex');

  const url = SCRIPT_URL;

  try {
    const response = await fetchComTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: "buscar" })
    }, 15000);
    
    const texto = await response.text();
    const resultado = JSON.parse(texto);
    if (resultado && resultado.result === "success") {
      slotsOcupadosNaNuvem = resultado.ocupados || [];
      ultimaSincronizacao = Date.now();
    }
  } catch (err) {
    console.log("Modo de leitura direta ativo.");
  }

  if (autoAvancarSeLotado) {
    verificarEAplicarSaltoAutomatico(dataSolicitada);
  }

  loading.classList.remove('flex');
  loading.classList.add('hidden');
  containerHorarios.classList.remove('hidden');
  
  renderizarGradeHorarios();
}

function renderizarGradeHorarios() {
  const gridM = document.getElementById('gridHorariosManha');
  const gridT = document.getElementById('gridHorariosTarde');

  const reservasLocais = lerReservasLocais();
  const renderBloco = function(listaHorarios) {
    return listaHorarios.map(function(horario) {
      const bloqueado = horarioIndisponivel(estadoAgendamento.data, horario, reservasLocais);

      const classesBtn = bloqueado
        ? "border-slate-200 bg-slate-100 text-slate-400"
        : "border-slate-200 bg-white text-brand-blue hover:border-brand-orange hover:bg-orange-50/50 cursor-pointer";

      return '<button type="button" onclick="window.selecionarHorario(\'' + horario + '\')" ' + (bloqueado ? 'disabled' : '') + ' class="slot-btn font-mono border-2 ' + classesBtn + ' py-2.5 px-2 rounded-xl text-center transition-all font-bold text-sm shadow-sm">' + horario + '</button>';
    }).join('');
  };

  gridM.innerHTML = renderBloco(horariosManha);
  gridT.innerHTML = renderBloco(horariosTarde);
}

window.selecionarHorario = function(horario) {
  estadoAgendamento.horario = horario;
  document.getElementById('alertaConflito').classList.add('hidden');
  atualizarResumoExtraStep4();
  window.voltarPara(4);
};
