// Validação e envio do agendamento ao Apps Script, com mensagens de erro.
// Traduz a resposta da planilha em mensagem para o associado.
// Devolve null só quando a planilha confirmou o agendamento ("success").
// Resposta vazia, página de erro (HTML) ou código desconhecido NUNCA contam como sucesso.
function mensagemDeRecusa(resultado) {
  const codigo = resultado && resultado.result;
  if (codigo === "success") return null;
  const ligar = " Se preferir, ligue para " + TELEFONE_CENTRAL + ".";

  if (codigo === "conflict") {
    return { titulo: "Horário Esgotado!", mensagem: "Outro associado acabou de reservar este horário segundos atrás. Volte e escolha outro horário.", atualizarHorarios: true };
  }
  if (codigo === "invalid") {
    const campo = resultado.campo;
    if (campo === "nome") return { titulo: "Nome inválido", mensagem: "Por favor, digite seu nome completo.", campoId: "inputNome" };
    if (campo === "telefone") return { titulo: "WhatsApp inválido", mensagem: "Digite o DDD seguido do número completo (ex: 19 99999-9999).", campoId: "inputTelefone" };
    if (campo === "placa") return { titulo: "Placa inválida", mensagem: "Digite uma placa válida de 7 caracteres (Ex: ABC1234 ou ABC1D23).", campoId: "inputPlaca" };
    if (campo === "data" || campo === "horario" || campo === "posto") {
      return { titulo: "Horário indisponível", mensagem: "Este dia ou horário não está mais disponível. Volte e escolha outro horário.", atualizarHorarios: true };
    }
    return { titulo: "Não foi possível agendar", mensagem: "Alguns dados do agendamento não conferem. Volte ao início e faça o agendamento novamente." + ligar };
  }
  if (codigo === "duplicate") {
    return { titulo: "Você já tem um agendamento", mensagem: "Já existe um agendamento ativo para esta placa, então não é possível agendar outro agora. Se precisar alterar, você poderá reagendar 24 horas depois do agendamento ou ligar para " + TELEFONE_CENTRAL + "." };
  }
  if (codigo === "rate_limited") {
    return { titulo: "Muitos agendamentos agora", mensagem: "Recebemos muitas solicitações neste momento. Tente novamente em alguns minutos. Se você já agendou, aguarde nossa mensagem no WhatsApp." + ligar };
  }
  if (codigo === "busy" || codigo === "error" || codigo === "invalid_action" || codigo === "unauthorized") {
    return { titulo: "Sistema ocupado", mensagem: "Não conseguimos registrar seu agendamento agora. Toque em Confirmar novamente em instantes." + ligar };
  }
  return { titulo: "Não conseguimos confirmar", mensagem: "Não recebemos a confirmação do seu agendamento. Toque em Confirmar novamente em instantes; se já tiver agendado, você verá um aviso." + ligar };
}

function exibirErroFormulario(titulo, msg, campoId) {
  document.getElementById('tituloErroForm').innerText = titulo;
  document.getElementById('msgErroForm').innerText = msg;
  document.getElementById('alertaConflito').classList.remove('hidden');
  const campo = campoId ? document.getElementById(campoId) : null;
  if (campo) {
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
  }
}

window.finalizarAgendamento = async function(event) {
  event.preventDefault();
  if (document.getElementById('btnConfirmar').disabled) return;
  document.getElementById('alertaConflito').classList.add('hidden');
  ['inputNome', 'inputTelefone', 'inputPlaca'].forEach(function(id) { document.getElementById(id).removeAttribute('aria-invalid'); });
  
  const hp = document.getElementById('website_hp').value;
  if (hp !== "") return;

  const nomeLimpo = sanitizarInput(document.getElementById('inputNome').value);
  const telLimpo = sanitizarInput(document.getElementById('inputTelefone').value);
  const telApenasNumeros = telLimpo.replace(/\D/g, "");
  const placaLimpa = sanitizarInput(document.getElementById('inputPlaca').value).toUpperCase();

  if (nomeLimpo.length < 3) {
    exibirErroFormulario("Nome inválido", "Por favor, digite seu nome completo.", "inputNome");
    return;
  }

  if (telApenasNumeros.length < 10 || telApenasNumeros.length > 11) {
    exibirErroFormulario("WhatsApp inválido", "Digite o DDD seguido do número completo (ex: 19 99999-9999).", "inputTelefone");
    return;
  }

  const regexPlaca = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
  if (!regexPlaca.test(placaLimpa)) {
    exibirErroFormulario("Placa inválida", "Digite uma placa válida de 7 caracteres (Ex: ABC1234 ou ABC1D23).", "inputPlaca");
    return;
  }

  const btn = document.getElementById('btnConfirmar');
  btn.disabled = true;
  btn.innerText = "Confirmando Agendamento…";

  const payload = {
    action: "salvar",
    dataRegistro: new Date().toLocaleString('pt-BR'),
    servico: sanitizarInput(estadoAgendamento.servico),
    posto: estadoAgendamento.posto ? sanitizarInput(estadoAgendamento.posto.nome) : POSTO_HENRICAR.nome,
    isTecnicoExterno: Boolean(estadoAgendamento.isTecnicoExterno),
    motivo: estadoAgendamento.isTecnicoExterno ? sanitizarInput(estadoAgendamento.motivoSemPosto || "") : "",
    cep: estadoAgendamento.cepFormatado,
    endereco: estadoAgendamento.enderecoFormatado,
    data: sanitizarInput(estadoAgendamento.data),
    horario: sanitizarInput(estadoAgendamento.horario),
    nome: nomeLimpo,
    telefone: telLimpo,
    placa: placaLimpa
  };

  const url = SCRIPT_URL;
  const liberarBotao = function() {
    btn.disabled = false;
    btn.innerText = "Confirmar Agendamento";
  };

  // Até 2 tentativas, sempre lendo a resposta. Se a 1ª não responder (internet instável), a 2ª é seguro:
  // a planilha recusa placa/horário repetidos, então o reenvio não grava duas vezes.
  let resultado = null;
  let respondeu = false;
  const tempos = [25000, 15000];
  for (let i = 0; i < tempos.length && !respondeu; i++) {
    try {
      const response = await fetchComTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }, tempos[i]);
      const textoResp = await response.text();
      try { resultado = JSON.parse(textoResp); } catch (e) { resultado = null; }
      respondeu = true;
    } catch (err) {
      // sem resposta: tenta de novo
    }
  }

  if (!respondeu) {
    liberarBotao();
    exibirErroFormulario("Sem conexão", "Não conseguimos enviar seu agendamento. Verifique sua internet e toque em Confirmar novamente, ou ligue para " + TELEFONE_CENTRAL + ".");
    return;
  }

  const recusa = mensagemDeRecusa(resultado);
  if (recusa) {
    liberarBotao();
    exibirErroFormulario(recusa.titulo, recusa.mensagem, recusa.campoId);
    if (recusa.atualizarHorarios) dispararBuscaDeHorariosNaNuvem(true, true);
    return;
  }

  if (!payload.isTecnicoExterno) {
    guardarReservaLocal(payload.data, payload.horario, payload.posto);
  }

  slotsOcupadosNaNuvem.push({ data: payload.data, horario: payload.horario, posto: payload.posto });

  document.getElementById('step4').classList.add('hidden');
  document.getElementById('blocoWhatsAppSucesso').classList.toggle('hidden', Boolean(payload.isTecnicoExterno));
  document.getElementById('blocoTecnicoSucesso').classList.toggle('hidden', !payload.isTecnicoExterno);
  if (payload.isTecnicoExterno) document.getElementById('textoPrazoTecnico').innerText = textoPrazoTecnico(obterDataHojeBrasil());
  const stepSucesso = document.getElementById('stepSucesso');
  stepSucesso.classList.remove('hidden');
  setTimeout(function() { stepSucesso.classList.add('animate-fade-in'); }, 10);
};
