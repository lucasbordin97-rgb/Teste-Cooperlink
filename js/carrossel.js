// Carrossel de marketing da tela inicial.
window.trocarSlideMarketing = function(novoIndice) {
  for (let i = 0; i < 3; i++) {
    const s = document.getElementById('slide' + i);
    const d = document.getElementById('dot' + i);
    if (!s || !d) continue;
    if (i === novoIndice) {
      s.classList.remove('opacity-0', 'pointer-events-none');
      s.classList.add('opacity-100');
      d.className = "w-5 h-2 rounded-full bg-brand-orange transition-all cursor-pointer";
    } else {
      s.classList.remove('opacity-100');
      s.classList.add('opacity-0', 'pointer-events-none');
      d.className = "w-2 h-2 rounded-full bg-white/40 hover:bg-white/70 transition-all cursor-pointer";
    }
  }
  slideAtual = novoIndice;
};

function iniciarCarrosselMarketing() {
  if (intervaloCarrossel) clearInterval(intervaloCarrossel);
  intervaloCarrossel = setInterval(function() {
    window.trocarSlideMarketing((slideAtual + 1) % 3);
  }, 6500);
}
