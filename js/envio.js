// Validação e envio do agendamento ao Apps Script, com mensagens de erro.
// Traduz a resposta da planilha em mensagem para o associado.
// Devolve null quando é sucesso (ou resposta desconhecida de uma versão antiga da planilha).
function mensagemDeRecusa(resultado) {
  const codigo = resultado && resultado.result;
  const ligar = " Se preferir, ligue para " + TELEFONE_CENTRAL + ".";

  if (codigo === "conflict") {
    return { titulo: "Horário Esgotado!", mensagem: "Outro associado acabou de reservar este horário segundos atrás. Volte e escolha outro horário.", atualizarHorarios: true };
  }
  if (codigo === "invalid") {
    const campo = resultado.campo;
    if (campo === "nome") return { titulo: "Nome inválido", mensagem: "Por favor, digite seu nome completo." };
    if (campo === "telefone") return { titulo: "WhatsApp inválido", mensagem: "Digite o DDD seguido do número completo (ex: 19 99999-9999)." };
    if (campo === "placa") return { titulo: "Placa inválida", mensagem: "Digite uma placa válida de 7 caracteres (Ex: ABC1234 ou ABC1D23)." };
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
  return null;
}

function exibirErroFormulario(titulo, msg) {
  document.getElementById('tituloErroForm').innerText = titulo;
  document.getElementById('msgErroForm').innerText = msg;
  document.getElementById('alertaConflito').classList.remove('hidden');
}

window.finalizarAgendamento = async function(event) {
  event.preventDefault();
  document.getElementById('alertaConflito').classList.add('hidden');
  
  const hp = document.getElementById('website_hp').value;
  if (hp !== "") return;

  const nomeLimpo = sanitizarInput(document.getElementById('inputNome').value);
  const telLimpo = sanitizarInput(document.getElementById('inputTelefone').value);
  const telApenasNumeros = telLimpo.replace(/\D/g, "");
  const placaLimpa = sanitizarInput(document.getElementById('inputPlaca').value).toUpperCase();

  if (nomeLimpo.length < 3) {
    exibirErroFormulario("Nome inválido", "Por favor, digite seu nome completo.");
    return;
  }

  if (telApenasNumeros.length < 10 || telApenasNumeros.length > 11) {
    exibirErroFormulario("WhatsApp inválido", "Digite o DDD seguido do número completo (ex: 19 99999-9999).");
    return;
  }

  const regexPlaca = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
  if (!regexPlaca.test(placaLimpa)) {
    exibirErroFormulario("Placa inválida", "Digite uma placa válida de 7 caracteres (Ex: ABC1234 ou ABC1D23).");
    return;
  }

  const btn = document.getElementById('btnConfirmar');
  btn.disabled = true;
  btn.innerText = "Confirmando Agendamento...";

  const payload = {
    action: "salvar",
    dataRegistro: new Date().toLocaleString('pt-BR'),
    servico: sanitizarInput(estadoAgendamento.servico),
    posto: estadoAgendamento.posto ? sanitizarInput(estadoAgendamento.posto.nome) : POSTO_HENRICAR.nome,
    isTecnicoExterno: Boolean(estadoAgendamento.isTecnicoExterno),
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

  try {
    // A planilha pode levar alguns segundos quando há vários envios ao mesmo tempo.
    const response = await fetchComTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }, 25000);

    const textoResp = await response.text();
    let resultado = null;
    try { resultado = JSON.parse(textoResp); } catch (e) {}

    const recusa = resultado ? mensagemDeRecusa(resultado) : null;
    if (recusa) {
      liberarBotao();
      exibirErroFormulario(recusa.titulo, recusa.mensagem);
      if (recusa.atualizarHorarios) dispararBuscaDeHorariosNaNuvem(true, true);
      return;
    }
  } catch (err) {
    // Sem resposta (internet instável): reenvia uma vez sem esperar retorno.
    // A planilha recusa horário duplicado, então o reenvio não ocupa a vaga duas vezes.
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (e2) {
      liberarBotao();
      exibirErroFormulario("Sem conexão", "Não conseguimos enviar seu agendamento. Verifique sua internet e toque em Confirmar novamente, ou ligue para " + TELEFONE_CENTRAL + ".");
      return;
    }
  }

  if (!payload.isTecnicoExterno) {
    guardarReservaLocal(payload.data, payload.horario, payload.posto);
  }

  slotsOcupadosNaNuvem.push({ data: payload.data, horario: payload.horario, posto: payload.posto });

  document.getElementById('step4').classList.add('hidden');
  const stepSucesso = document.getElementById('stepSucesso');
  stepSucesso.classList.remove('hidden');
  setTimeout(function() { stepSucesso.classList.add('animate-fade-in'); }, 10);
};
