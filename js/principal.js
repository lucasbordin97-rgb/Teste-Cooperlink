// Reinício do fluxo e inicialização da página.
window.reiniciarFluxo = function() {
  document.getElementById('formAgendamento').reset();
  document.getElementById('stepSucesso').classList.add('hidden');
  document.getElementById('stepSucesso').classList.remove('animate-fade-in');
  document.getElementById('inputCEP').value = "";
  document.getElementById('cepFeedback').innerHTML = "";
  document.getElementById('boxTecnicoExterno').classList.add('hidden');
  document.getElementById('boxPostosFixos').classList.add('hidden');
  esconderCaixasCobertura();
  document.getElementById('alertaConflito').classList.add('hidden');
  document.getElementById('avisoAutoAvanco').classList.add('hidden');
  definirDataMinimaLocal();
  
  const btn = document.getElementById('btnConfirmar');
  btn.disabled = false;
  btn.innerText = "Confirmar Agendamento";
  
  window.voltarPara(1);
};

document.addEventListener('DOMContentLoaded', function() {
  limparDadosPessoaisAntigos();
  definirDataMinimaLocal();
  iniciarCarrosselMarketing();
});
