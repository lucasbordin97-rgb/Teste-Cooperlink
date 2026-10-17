// Leitura/gravação segura no navegador e reservas locais (sem dados pessoais).
function lerStorageSeguro(tipo, chave, valorPadrao) {
  try {
    const st = (tipo === 'session') ? window.sessionStorage : window.localStorage;
    const val = st.getItem(chave);
    return val !== null ? val : valorPadrao;
  } catch (e) {
    return valorPadrao;
  }
}

function salvarStorageSeguro(tipo, chave, valor) {
  try {
    const st = (tipo === 'session') ? window.sessionStorage : window.localStorage;
    st.setItem(chave, valor);
  } catch (e) {}
}

function removerStorageSeguro(tipo, chave) {
  try {
    const st = (tipo === 'session') ? window.sessionStorage : window.localStorage;
    st.removeItem(chave);
  } catch (e) {}
}

// Reservas feitas neste aparelho: guarda apenas data, horário e posto (nada pessoal).
function lerReservasLocais() {
  try {
    const lista = JSON.parse(lerStorageSeguro('local', 'agendamentos_db', '[]') || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

function guardarReservaLocal(data, horario, posto) {
  const lista = lerReservasLocais();
  lista.push({ data: data, horario: horario, posto: posto });
  salvarStorageSeguro('local', 'agendamentos_db', JSON.stringify(lista.slice(-20)));
}

// Versões anteriores do site guardavam nome, telefone e placa no navegador.
// Ao abrir, reescreve a lista só com data, horário e posto e apaga chaves antigas.
function limparDadosPessoaisAntigos() {
  const limpa = lerReservasLocais()
    .filter(function(r) { return r && r.data && r.horario; })
    .map(function(r) { return { data: String(r.data), horario: String(r.horario), posto: String(r.posto || '') }; });
  if (limpa.length) {
    salvarStorageSeguro('local', 'agendamentos_db', JSON.stringify(limpa.slice(-20)));
  } else {
    removerStorageSeguro('local', 'agendamentos_db');
  }
  removerStorageSeguro('local', 'google_script_url');
  removerStorageSeguro('session', 'ultimo_envio_ts');
}
