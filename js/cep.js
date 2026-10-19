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
  if (btn.disabled) return;

  boxTecnico.classList.add('hidden');
  boxPostos.classList.add('hidden');
  esconderCaixasCobertura();

  if (rawCep.length !== 8) {
    feedback.innerHTML = '<span class="text-rose-500 font-semibold">CEP inválido. Digite os 8 números do CEP.</span>';
    return;
  }

  btn.disabled = true;
  btn.innerText = "Consultando CEP…";
  feedback.innerHTML = "";

  let data = null;
  try {
    const res = await fetchComTimeout("https://viacep.com.br/ws/" + rawCep + "/json/", {}, 7000);
    data = await res.json();
  } catch (error) {
    data = null;
  }
  const respostaValida = function(d) { return !!d && typeof d === 'object' && !Array.isArray(d); };

  // viaCEP fora do ar ou lento: se a nossa tabela conhece o CEP (Grande SP), segue sem ele.
  let semViaCep = false;
  if (!respostaValida(data) && USAR_TABELA_COBERTURA) {
    const conhecida = await consultarCoberturaSegura(rawCep);
    if (conhecida && conhecida.noMapa) {
      data = { localidade: 'Grande São Paulo', uf: 'SP' };
      semViaCep = true;
    }
  }

  btn.disabled = false;
  btn.innerText = "Verificar Disponibilidade";

  if (!respostaValida(data)) {
    feedback.innerHTML = '<span class="text-rose-500 font-semibold">Oscilação na rede ao buscar o CEP. Toque novamente.</span>';
    return;
  }
  if (data.erro) {
    feedback.innerHTML = '<span class="text-rose-500 font-semibold">CEP não encontrado. Verifique os números digitados.</span>';
    return;
  }

  try {
    estadoAgendamento.cep = rawCep;
    estadoAgendamento.cepFormatado = sanitizarInput(maskedCep);
    estadoAgendamento.enderecoFormatado = semViaCep
      ? sanitizarInput("CEP " + maskedCep + " - Grande São Paulo/SP")
      : sanitizarInput((data.logradouro || 'Bairro') + ", " + (data.bairro || '') + " - " + data.localidade + "/" + data.uf);

    const cidadeNorm = normalizarTexto(data.localidade);
    const isRegiaoAtendida = (cidadeNorm === "campinas" || cidadeNorm === "hortolandia");

    if (!isRegiaoAtendida && USAR_TABELA_COBERTURA) {
      const cobertura = await consultarCoberturaSegura(rawCep);
      if (cobertura) {
        aplicarCobertura(cobertura, data, feedback, boxTecnico);
        return;
      }
    }

    if (!isRegiaoAtendida) {
      estadoAgendamento.isTecnicoExterno = true;
      feedback.innerHTML = '<span class="text-amber-600 font-semibold">Sua região (' + escaparHtml(sanitizarInput(data.localidade)) + '/' + escaparHtml(sanitizarInput(data.uf)) + ') é atendida via Técnico Parceiro:</span>';
      boxTecnico.classList.remove('hidden');
    } else {
      estadoAgendamento.isTecnicoExterno = false;
      feedback.innerHTML = '<span class="text-emerald-600 font-semibold">Atendimento liberado na unidade credenciada local:</span>';
      boxPostos.classList.remove('hidden');
    }
  } catch (error) {
    feedback.innerHTML = '<span class="text-rose-500 font-semibold">Não foi possível analisar este CEP agora. Toque novamente.</span>';
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

window.confirmarPostoParceiro = function(nomePosto, rotulo) {
  estadoAgendamento.posto = { nome: nomePosto };
  estadoAgendamento.isTecnicoExterno = false;
  document.getElementById('resumoModalidade').innerText = rotulo || "Unidade Credenciada Henricar (Campinas)";
  
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

// ---- Cobertura por tempo de carro (só com USAR_TABELA_COBERTURA ligado) ----
function esconderCaixasCobertura() {
  document.getElementById('boxPostosSP').classList.add('hidden');
  document.getElementById('boxForaCobertura').classList.add('hidden');
  document.getElementById('formInteresse').classList.remove('hidden');
  document.getElementById('interesseSucesso').classList.add('hidden');
  document.getElementById('interesseErro').classList.add('hidden');
}

function aplicarCobertura(cobertura, dadosCep, feedback, boxTecnico) {
  const local = escaparHtml(sanitizarInput(dadosCep.localidade)) + '/' + escaparHtml(sanitizarInput(dadosCep.uf));

  if (cobertura.postos.length > 0) {
    estadoAgendamento.isTecnicoExterno = false;
    feedback.innerHTML = '<span class="text-emerald-600 font-semibold">Atendimento liberado em unidade credenciada perto de você:</span>';
    document.getElementById('listaPostosSP').innerHTML = cobertura.postos.map(function(p, i) {
      const posto = POSTOS_SP[p.id];
      const rotulo = posto.curto + ', ' + posto.local;
      const selo = i === 0 ? '<span class="text-[11px] font-extrabold tracking-wider uppercase text-white bg-brand-orange px-2 py-0.5 rounded-full">Mais próximo</span>' : '';
      return '<button type="button" data-arg="' + p.id + '" data-minutos="' + p.minutos + '" aria-label="Escolher ' + rotulo + '" data-click="escolherPostoSP" class="block w-full bg-blue-50/60 border-2 border-brand-blue p-4 rounded-2xl text-left transition-[transform,box-shadow,border-color,background-color,color,opacity] hover:bg-blue-50 hover:shadow-md cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2">' +
        '<div class="flex flex-wrap items-center gap-x-2 gap-y-1">' + selo + '<span class="text-[11px] font-extrabold tracking-wider text-[#b8440f] uppercase">Unidade Credenciada</span></div>' +
        '<h3 class="font-display font-extrabold text-brand-blue text-lg leading-snug mt-1">' + posto.curto + ' — ' + posto.local + '</h3>' +
        '<p class="text-sm text-slate-600 font-medium mt-0.5 leading-relaxed">' + posto.endereco + '</p>' +
        '<div class="mt-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-orange group-hover:translate-x-1 transition-transform">Escolher Data e Horário →</div></button>';
    }).join('');
    document.getElementById('boxPostosSP').classList.remove('hidden');
    return;
  }

  if (cobertura.noMapa || cidadeEhGrandeSP(dadosCep.localidade)) {
    estadoAgendamento.isTecnicoExterno = true;
    feedback.innerHTML = '<span class="text-amber-600 font-semibold">Sua região (' + local + ') é atendida via Técnico Parceiro:</span>';
    boxTecnico.classList.remove('hidden');
    return;
  }

  estadoAgendamento.isTecnicoExterno = false;
  estadoAgendamento.cidadeInteresse = sanitizarInput(dadosCep.localidade);
  estadoAgendamento.ufInteresse = sanitizarInput(dadosCep.uf);
  feedback.innerHTML = '<span class="text-amber-600 font-semibold">Ainda não atendemos a sua região (' + local + ').</span>';
  document.getElementById('boxForaCobertura').classList.remove('hidden');
}

window.escolherPostoSP = function(id) {
  const posto = POSTOS_SP[id];
  if (!posto) return;
  window.confirmarPostoParceiro(posto.nome, "Unidade Credenciada " + posto.curto + " (" + posto.local + ")");
};

// Registra o interesse de quem está fora da cobertura. Só envia com o consentimento marcado.
window.enviarInteresse = async function(event) {
  event.preventDefault();
  const erro = document.getElementById('interesseErro');
  erro.classList.add('hidden');

  const nome = sanitizarInput(document.getElementById('interesseNome').value);
  const telefone = sanitizarInput(document.getElementById('interesseTelefone').value);
  const telNumeros = telefone.replace(/\D/g, "");
  const consentimento = document.getElementById('interesseConsentimento').checked;
  const mostrarErro = function(msg, campoId) {
    erro.innerText = msg;
    erro.classList.remove('hidden');
    const campo = campoId ? document.getElementById(campoId) : null;
    if (campo) { campo.setAttribute('aria-invalid', 'true'); campo.focus(); }
  };
  ['interesseNome', 'interesseTelefone', 'interesseConsentimento'].forEach(function(id) { document.getElementById(id).removeAttribute('aria-invalid'); });

  if (document.getElementById('website_hp_interesse').value !== "") return;
  if (nome.length < 3) return mostrarErro("Por favor, digite seu nome completo.", "interesseNome");
  if (telNumeros.length < 10 || telNumeros.length > 11) return mostrarErro("Digite o DDD seguido do número completo (ex: 19 99999-9999).", "interesseTelefone");
  if (!consentimento) return mostrarErro("Marque a caixa para autorizar o nosso contato.", "interesseConsentimento");

  const btn = document.getElementById('btnInteresse');
  btn.disabled = true;
  btn.innerText = "Enviando…";
  const liberar = function() { btn.disabled = false; btn.innerText = "Quero ser avisado"; };

  try {
    const response = await fetchComTimeout(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: "interesse",
        dataRegistro: new Date().toLocaleString('pt-BR'),
        cep: estadoAgendamento.cepFormatado,
        cidade: estadoAgendamento.cidadeInteresse || "",
        uf: estadoAgendamento.ufInteresse || "",
        nome: nome,
        telefone: telefone,
        consentimento: true
      })
    }, 25000);
    const resultado = JSON.parse(await response.text());
    if (!resultado || resultado.result !== "success") {
      liberar();
      return mostrarErro("Não conseguimos registrar agora. Tente novamente em instantes ou ligue para " + TELEFONE_CENTRAL + ".");
    }
  } catch (err) {
    liberar();
    return mostrarErro("Não conseguimos registrar agora. Verifique sua internet e tente novamente, ou ligue para " + TELEFONE_CENTRAL + ".");
  }

  liberar();
  document.getElementById('formInteresse').classList.add('hidden');
  document.getElementById('interesseSucesso').classList.remove('hidden');
};
