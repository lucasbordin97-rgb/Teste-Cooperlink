// Navegação entre etapas, indicador de progresso e máscaras de CEP, telefone e placa.
window.voltarPara = function(etapa) {
  const idsEtapas = ['step1', 'step2', 'step3', 'step4', 'stepSucesso'];
  idsEtapas.forEach(function(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('animate-fade-in');
    }
  });

  const alvo = document.getElementById('step' + etapa);
  if (alvo) {
    alvo.classList.remove('hidden');
    setTimeout(function() { alvo.classList.add('animate-fade-in'); }, 10);
  }
  atualizarTracker(etapa);

  const badgeTopo = document.getElementById('badgeServicoTopo');
  if (badgeTopo) {
    badgeTopo.innerText = (etapa > 1 && estadoAgendamento.servico)
      ? "Serviço: " + estadoAgendamento.servico
      : "Agendamento Online";
  }
};

window.voltarDeEtapa4 = function() {
  if (estadoAgendamento.isTecnicoExterno) {
    window.voltarPara(2);
  } else {
    window.voltarPara(3);
  }
};

function atualizarTracker(etapaAtual) {
  const numEtapa = Number(etapaAtual) || 1;
  const percentage = ((numEtapa - 1) / 3) * 100;
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = Math.min(100, Math.max(0, percentage)) + '%';

  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('pStep' + i);
    if (!el) continue;
    if (i <= numEtapa) {
      el.className = "w-8 h-8 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-sm shadow-md transition-colors border-2 border-white z-10";
    } else {
      el.className = "w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm border-2 border-white transition-colors z-10";
    }
  }
}

function atualizarResumoExtraStep4() {
  const elExtra = document.getElementById('resumoDataHoraExtra');
  if (!elExtra) return;
  if (estadoAgendamento.isTecnicoExterno) {
    elExtra.innerText = "Serviço: " + estadoAgendamento.servico + " • CEP: " + estadoAgendamento.cepFormatado;
  } else {
    const dataBr = formatarDataBR(estadoAgendamento.data);
    elExtra.innerText = "Serviço: " + estadoAgendamento.servico + " • Data: " + dataBr + " às " + estadoAgendamento.horario;
  }
}

window.mascaraCEP = function(input) {
  let v = input.value.replace(/\D/g, "");
  v = v.replace(/^(\d{5})(\d)/, "$1-$2");
  input.value = v;
};

window.mascaraTelefone = function(input) {
  let v = input.value.replace(/\D/g, "");
  v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
  v = v.replace(/(\d)(\d{4})$/, "$1-$2");
  input.value = v;
};

window.formatarPlaca = function(input) {
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

window.selecionarServico = function(servico) {
  estadoAgendamento.servico = servico;
  window.voltarPara(2);
};
