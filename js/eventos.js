// Ligação dos eventos da página. O HTML marca o que cada elemento faz (data-click, data-input,
// data-submit, data-change, data-enter) e aqui chamamos a função certa, sem scripts dentro do HTML.
(function() {
  function acao(nome) {
    return typeof window[nome] === 'function' ? window[nome] : null;
  }
  function argumento(el) {
    var a = el.dataset.arg;
    return a !== undefined && /^\d+$/.test(a) ? Number(a) : a;
  }

  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-click]');
    var fn = el && acao(el.dataset.click);
    if (fn) fn(argumento(el));
  });
  document.addEventListener('input', function(e) {
    var el = e.target.closest('[data-input]');
    var fn = el && acao(el.dataset.input);
    if (fn) fn(el);
  });
  document.addEventListener('change', function(e) {
    var el = e.target.closest('[data-change]');
    var fn = el && acao(el.dataset.change);
    if (fn) fn(el);
  });
  document.addEventListener('submit', function(e) {
    var el = e.target.closest('[data-submit]');
    var fn = el && acao(el.dataset.submit);
    if (fn) fn(e);
  });
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var el = e.target.closest('[data-enter]');
    var fn = el && acao(el.dataset.enter);
    if (fn) { e.preventDefault(); fn(); }
  });

  // Foto que não carrega some, em vez de mostrar o ícone de imagem quebrada.
  function esconderSeQuebrada(img) {
    if (img.complete && img.naturalWidth === 0) img.style.display = 'none';
  }
  document.addEventListener('error', function(e) {
    if (e.target && e.target.tagName === 'IMG') e.target.style.display = 'none';
  }, true);
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('#carrossel img').forEach(esconderSeQuebrada);
  });
})();
