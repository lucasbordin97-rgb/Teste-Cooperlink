// Busca do CEP (viaCEP) e escolha entre posto parceiro ou técnico externo.
function normalizarTexto(texto) {
  if (!texto) return "";
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

window.buscarEAnalisarCEP = async function() {
  const inputEl = document.getElementById('inputCEP');
  const rawCep = (inputEl ? inputEl.value : "").replace(/\D/g, '');
  const maskedCep = inputEl ? inputEl.value : "";
  const feedback = document.getElementById('cepFeedback');
  const boxTecnico = document.getElementById('boxTecnicoExterno');
  const boxPostos = document.getElementById('boxPostosFixos');
  const btn = document.getElementById('btnBuscarCep');

  boxTecnico.classList.add('hidden');
  boxPostos.classList.add('hidden');

  if (rawCep.length !== 8) {
    feedback.innerHTML = '<span class="text-rose-500 font-semibold">CEP inválido. Digite os 8 números do CEP.</span>';
    return;
  }

  btn.disabled = true;
  btn.innerText = "Consultando CEP...";
  feedback.innerHTML = "";

  try {
    const res = await fetchComTimeout("https://viacep.com.br/ws/" + rawCep + "/json/", {}, 7000);
    const data = await res.json();

    btn.disabled = false;
    btn.innerText = "Verificar Disponibilidade";

    if (data.erro) {
      feedback.innerHTML = '<span class="text-rose-500 font-semibold">CEP não encontrado. Verifique os números digitados.</span>';
      return;
    }

    estadoAgendamento.cep = rawCep;
    estadoAgendamento.cepFormatado = sanitizarInput(maskedCep);
    estadoAgendamento.enderecoFormatado = sanitizarInput((data.logradouro || 'Bairro') + ", " + (data.bairro || '') + " - " + data.localidade + "/" + data.uf);

    const cidadeNorm = normalizarTexto(data.localidade);
    const isRegiaoAtendida = (cidadeNorm === "campinas" || cidadeNorm === "hortolandia");

    if (!isRegiaoAtendida) {
      estadoAgendamento.isTecnicoExterno = true;
      feedback.innerHTML = '<span class="text-amber-600 font-semibold">Sua região (' + sanitizarInput(data.localidade) + '/' + sanitizarInput(data.uf) + ') é atendida via Técnico Parceiro:</span>';
      boxTecnico.classList.remove('hidden');
    } else {
      estadoAgendamento.isTecnicoExterno = false;
      feedback.innerHTML = '<span class="text-emerald-600 font-semibold">Atendimento liberado na unidade credenciada local:</span>';
      boxPostos.classList.remove('hidden');
    }
  } catch (error) {
    btn.disabled = false;
    btn.innerText = "Verificar Disponibilidade";
    feedback.innerHTML = '<span class="text-rose-500 font-semibold">Oscilação na rede ao buscar o CEP. Toque novamente.</span>';
  }
};

window.encaminharParaTecnicoParceiro = function() {
  estadoAgendamento.posto = { nome: "Agend. Tecnico Parceiro - CEP: " + estadoAgendamento.cepFormatado };
  estadoAgendamento.isTecnicoExterno = true;
  estadoAgendamento.data = "A agendar via técnico";
  estadoAgendamento.horario = "A agendar";
  
  document.getElementById('resumoModalidade').innerText = "Técnico Parceiro (Atendimento Externo)";
  document.getElementById('alertaConflito').classList.add('hidden');
  atualizarResumoExtraStep4();
  window.voltarPara(4);
};

window.confirmarPostoParceiro = function(nomePosto) {
  estadoAgendamento.posto = { nome: nomePosto };
  estadoAgendamento.isTecnicoExterno = false;
  document.getElementById('resumoModalidade').innerText = "Unidade Credenciada Henricar (Campinas)";
  
  const hoje = obterDataHojeBrasil();
  estadoAgendamento.data = hoje;
  const inputData = document.getElementById('dataAgendamento');
  if (inputData) inputData.value = hoje;
  
  document.getElementById('avisoFimDeSemana').classList.add('hidden');
  document.getElementById('avisoDataForaJanela').classList.add('hidden');
  document.getElementById('avisoAutoAvanco').classList.add('hidden');

  window.voltarPara(3);
  dispararBuscaDeHorariosNaNuvem(false, true);
};
