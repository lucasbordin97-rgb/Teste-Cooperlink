// Carrossel de marketing da tela inicial.
window.trocarSlideMarketing = function(novoIndice) {
  for (let i = 0; i < 3; i++) {
    const s = document.getElementById('slide' + i);
    const d = document.getElementById('dot' + i);
    if (!s || !d) continue;
    if (i === novoIndice) {
      s.classList.remove('opacity-0', 'pointer-events-none');
      s.classList.add('opacity-100');
      s.setAttribute('aria-hidden', 'false');
      d.className = "w-5 h-2 rounded-full bg-brand-orange transition-[width,background-color] cursor-pointer";
    } else {
      s.classList.remove('opacity-100');
      s.classList.add('opacity-0', 'pointer-events-none');
      s.setAttribute('aria-hidden', 'true');
      d.className = "w-2 h-2 rounded-full bg-white/40 hover:bg-white/70 transition-[width,background-color] cursor-pointer";
    }
  }
  slideAtual = novoIndice;
};

// O carrossel passa sozinho a cada 6,5 s. Pausa enquanto o mouse ou o foco estão nele, quando a
// pessoa pede para pausar e sempre que o aparelho está configurado para reduzir movimento.
// Também dá para arrastar o dedo (celular) e usar as setas do teclado.
let carrosselPausadoPeloUsuario = false;
let carrosselSobPonteiro = false;
let gestosCarrosselProntos = false;
function prefereMovimentoReduzido() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function pararCarrossel() {
  if (intervaloCarrossel) clearInterval(intervaloCarrossel);
  intervaloCarrossel = null;
}
function iniciarCarrosselMarketing() {
  pararCarrossel();
  prepararGestosCarrossel();
  if (carrosselPausadoPeloUsuario || carrosselSobPonteiro || prefereMovimentoReduzido()) return;
  intervaloCarrossel = setInterval(function() {
    window.trocarSlideMarketing((slideAtual + 1) % 3);
  }, 6500);
}
function irParaSlideVizinho(passo) {
  window.trocarSlideMarketing((slideAtual + passo + 3) % 3);
}
function prepararGestosCarrossel() {
  const area = document.getElementById('carrossel');
  if (!area || gestosCarrosselProntos) return;
  gestosCarrosselProntos = true;
  let inicioX = null;
  area.addEventListener('touchstart', function(e) { inicioX = e.touches[0].clientX; }, { passive: true });
  area.addEventListener('touchend', function(e) {
    if (inicioX === null) return;
    const dx = e.changedTouches[0].clientX - inicioX;
    inicioX = null;
    if (Math.abs(dx) > 40) { irParaSlideVizinho(dx < 0 ? 1 : -1); iniciarCarrosselMarketing(); }
  }, { passive: true });
  area.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight') { irParaSlideVizinho(1); iniciarCarrosselMarketing(); }
    if (e.key === 'ArrowLeft') { irParaSlideVizinho(-1); iniciarCarrosselMarketing(); }
  });
  const sob = function(valor) { return function() { carrosselSobPonteiro = valor; iniciarCarrosselMarketing(); }; };
  area.addEventListener('mouseenter', sob(true));
  area.addEventListener('mouseleave', sob(false));
  area.addEventListener('focusin', sob(true));
  area.addEventListener('focusout', sob(false));
}
window.alternarCarrossel = function() {
  carrosselPausadoPeloUsuario = !carrosselPausadoPeloUsuario;
  carrosselSobPonteiro = false; // o pedido explícito da pessoa vale mais do que o mouse estar em cima
  const btn = document.getElementById('btnPausaCarrossel');
  if (btn) {
    btn.setAttribute('aria-pressed', String(carrosselPausadoPeloUsuario));
    btn.setAttribute('aria-label', carrosselPausadoPeloUsuario ? 'Retomar apresentação' : 'Pausar apresentação');
    document.getElementById('iconePausa').classList.toggle('hidden', carrosselPausadoPeloUsuario);
    document.getElementById('iconeTocar').classList.toggle('hidden', !carrosselPausadoPeloUsuario);
  }
  iniciarCarrosselMarketing();
};
