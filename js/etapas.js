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

  const nomes = ['serviço', 'região', 'horário', 'veículo'];
  for (let i = 1; i <= 4; i++) {
    const no = document.getElementById('pStep' + i);
    const rotulo = document.getElementById('pLabel' + i);
    if (!no) continue;
    const estado = i < numEtapa ? 'is-done' : i === numEtapa ? 'is-current' : 'is-todo';
    const texto = i < numEtapa ? 'concluída' : i === numEtapa ? 'atual' : 'pendente';
    no.className = 'rota-no ' + estado;
    no.setAttribute('aria-label', 'Etapa ' + i + ', ' + nomes[i - 1] + ': ' + texto);
    if (i === numEtapa) no.setAttribute('aria-current', 'step'); else no.removeAttribute('aria-current');
    if (rotulo) rotulo.className = 'rota-label' + (estado === 'is-todo' ? '' : ' ' + estado);
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
