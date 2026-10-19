// Testes de acessibilidade e acabamento (sem internet): rótulos, ícones, campos, carrossel, foco e movimento.
// Uso: node tests/acessibilidade.test.js index.html   (precisa do pacote "playwright" e do Chromium)
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs');
const arquivo = path.resolve(process.argv[2] || 'index.html');
const raiz = path.dirname(arquivo);
const html = fs.readFileSync(arquivo, 'utf8');
const H = {}; for (const h of JSON.parse(fs.readFileSync(path.join(raiz, 'vercel.json'), 'utf8')).headers[0].headers) H[h.key] = h.value;
const viol = [];
let falhas = 0;
const t = (n, c, x) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + n + (c ? '' : ' -> ' + JSON.stringify(x))); if (!c) falhas++; };
const tag = id => (html.match(new RegExp('<[a-z]+ [^>]*id="' + id + '"[^>]*>')) || [''])[0];

// ---------- 1) Marcação (estática) ----------
const labels = [...html.matchAll(/<label\b[^>]*>/g)].map(m => m[0]);
const semFor = labels.filter(l => !/\bfor="/.test(l));
t('todo <label> está ligado a um campo (for=)', semFor.length === 0, semFor.map(l => l.slice(0, 70)));
const forSemAlvo = labels.map(l => (l.match(/\bfor="([^"]+)"/) || [])[1]).filter(Boolean).filter(id => !new RegExp('id="' + id + '"').test(html));
t('todo for= aponta para um id que existe', forSemAlvo.length === 0, forSemAlvo);
const svgs = [...html.matchAll(/<svg\b[^>]*>/g)].map(m => m[0]);
t('todo ícone <svg> é decorativo (aria-hidden="true")', svgs.every(s => /aria-hidden="true"/.test(s)), svgs.filter(s => !/aria-hidden="true"/.test(s)).length + ' sem');
const css = fs.readFileSync(path.join(raiz, 'css/estilos.css'), 'utf8');
const js = fs.readdirSync(path.join(raiz, 'js')).map(f => fs.readFileSync(path.join(raiz, 'js', f), 'utf8')).join('\n');
t('nenhum "transition: all" / transition-all (só propriedades listadas)', !/transition-all|transition:\s*all/.test(html + css + js));
t('CEP: inputmode numérico e autocomplete de CEP', /inputmode="numeric"/.test(tag('inputCEP')) && /autocomplete="postal-code"/.test(tag('inputCEP')), tag('inputCEP'));
t('WhatsApp: type tel, inputmode tel e autocomplete tel', /inputmode="tel"/.test(tag('inputTelefone')) && /autocomplete="tel"/.test(tag('inputTelefone')), tag('inputTelefone'));
t('Nome: autocomplete name; Placa: sem autocomplete e sem corretor', /autocomplete="name"/.test(tag('inputNome')) && /autocomplete="off"/.test(tag('inputPlaca')) && /spellcheck="false"/.test(tag('inputPlaca')));
t('avisos anunciados: CEP em aria-live, erro em role=alert', /id="cepFeedback" aria-live="polite"/.test(html) && /id="alertaConflito" role="alert"/.test(html));
t('imagens do carrossel com largura/altura; 2ª e 3ª com lazy-loading', (html.match(/<img src="https:\/\/images\.unsplash[^>]*width="1200" height="800"/g) || []).length === 3 && (html.match(/<img src="https:\/\/images\.unsplash[^>]*loading="lazy"/g) || []).length === 2);
t('sem saltos de nível de título (nenhum h4)', !/<h4\b/.test(html));

t('sem scripts dentro do HTML (onclick/oninput/...) e a política de segurança não aceita script inline', !/\son(click|input|change|submit|keydown|error|load)=/.test(html + js.replace(/data-/g, '')) && !/script-src[^;]*'unsafe-inline'/.test(H['Content-Security-Policy']), H['Content-Security-Policy']);

// ---------- 2) Comportamento ----------
async function novaPagina(browser, opcoes) {
  const ctx = await browser.newContext(Object.assign({ timezoneId: 'America/Sao_Paulo', locale: 'pt-BR', hasTouch: true }, opcoes || {}));
  const page = await ctx.newPage();
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text()); });
  const erros = []; page.on('pageerror', e => erros.push(String(e)));
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u === 'http://site.local/') return route.fulfill({ contentType: 'text/html', headers: H, body: html });
    if (u.includes('script.google.com')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: 'success', ocupados: [] }) });
    if (u.startsWith('http://site.local/')) {
      const p = path.join(raiz, new URL(u).pathname);
      if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'nao encontrado' });
      return route.fulfill({ contentType: p.endsWith('.css') ? 'text/css' : 'application/javascript', headers: H, body: fs.readFileSync(p) });
    }
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind = {};' });
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });
  return { page, ctx, erros };
}
const ocultos = page => page.evaluate(() => [0, 1, 2].map(i => document.getElementById('slide' + i).getAttribute('aria-hidden')));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

  let { page, ctx, erros } = await novaPagina(browser);
  await page.goto('http://site.local/');
  t('slides: só o visível fica sem aria-hidden', JSON.stringify(await ocultos(page)) === '["false","true","true"]', await ocultos(page));
  await page.evaluate(() => window.trocarSlideMarketing(1));
  t('trocar de slide atualiza o aria-hidden', JSON.stringify(await ocultos(page)) === '["true","false","true"]', await ocultos(page));
  t('carrossel é uma região nomeada', await page.evaluate(() => { const c = document.getElementById('carrossel'); return c.getAttribute('role') === 'region' && !!c.getAttribute('aria-label'); }));

  // pausa
  const rodando = () => page.evaluate(() => intervaloCarrossel !== null);
  t('carrossel começa rodando', await rodando());
  await page.click('#btnPausaCarrossel');
  t('botão de pausa: para o carrossel e marca aria-pressed', !(await rodando()) && (await page.getAttribute('#btnPausaCarrossel', 'aria-pressed')) === 'true');
  await page.click('#btnPausaCarrossel');
  t('botão de pausa: retoma', (await rodando()) && (await page.getAttribute('#btnPausaCarrossel', 'aria-pressed')) === 'false');

  // pausa com o mouse em cima
  await page.mouse.move(2, 2);
  await page.hover('#carrossel');
  t('mouse sobre o carrossel pausa', !(await rodando()));
  await page.mouse.move(2, 2);
  t('tirar o mouse retoma', await rodando());

  // arrastar o dedo
  await page.evaluate(() => window.trocarSlideMarketing(0));
  await page.evaluate(() => {
    const el = document.getElementById('carrossel');
    const toque = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: 100 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [toque(300)], changedTouches: [toque(300)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [toque(150)] }));
  });
  t('arrastar para a esquerda avança o slide', JSON.stringify(await ocultos(page)) === '["true","false","true"]', await ocultos(page));

  // setas do teclado
  await page.focus('#dot1');
  await page.keyboard.press('ArrowRight');
  t('seta para a direita (foco no carrossel) avança o slide', JSON.stringify(await ocultos(page)) === '["true","true","false"]', await ocultos(page));
  await page.keyboard.press('ArrowLeft');
  t('seta para a esquerda volta o slide', JSON.stringify(await ocultos(page)) === '["true","false","true"]', await ocultos(page));
  t('página sem erros de JavaScript', erros.length === 0, erros);
  await ctx.close();

  // movimento reduzido: o carrossel não passa sozinho
  ({ page, ctx } = await novaPagina(browser, { reducedMotion: 'reduce' }));
  await page.goto('http://site.local/');
  t('"reduzir movimento": o carrossel não roda sozinho', !(await page.evaluate(() => intervaloCarrossel !== null)));
  await ctx.close();

  // link de pular e barra de etapas
  ({ page, ctx } = await novaPagina(browser));
  await page.goto('http://site.local/');
  await page.keyboard.press('Tab');
  const primeiro = await page.evaluate(() => ({ cls: document.activeElement.className, href: document.activeElement.getAttribute('href') }));
  t('primeiro Tab cai no link "Pular para o agendamento", que existe como destino', /skip-link/.test(primeiro.cls) && primeiro.href === '#conteudo' && (await page.evaluate(() => !!document.getElementById('conteudo'))), primeiro);
  const estados = () => page.evaluate(() => [1, 2, 3, 4].map(i => document.getElementById('pStep' + i).className.replace('rota-no ', '')));
  t('barra de etapas começa: 1 atual, resto pendente', JSON.stringify(await estados()) === '["is-current","is-todo","is-todo","is-todo"]', await estados());
  await page.evaluate(() => window.selecionarServico('Instalação'));
  t('na etapa 2: 1 concluída, 2 atual, aria-current na atual', JSON.stringify(await estados()) === '["is-done","is-current","is-todo","is-todo"]' && (await page.getAttribute('#pStep2', 'aria-current')) === 'step' && (await page.getAttribute('#pStep1', 'aria-current')) === null, await estados());

  // foco no campo inválido (o navegador já barra nome curto/vazio por conta própria; testamos o que é nosso)
  await page.evaluate(() => window.voltarPara(4));
  await page.fill('#inputNome', 'Maria da Silva');
  await page.fill('#inputTelefone', '123');
  await page.fill('#inputPlaca', 'abc1d23');
  await page.evaluate(() => { document.getElementById('formAgendamento').requestSubmit(); });
  await page.waitForFunction(() => !document.getElementById('alertaConflito').classList.contains('hidden'));
  const foco = await page.evaluate(() => ({ id: document.activeElement.id, inv: document.activeElement.getAttribute('aria-invalid') }));
  t('WhatsApp inválido: o foco vai para o campo e ele fica aria-invalid', foco.id === 'inputTelefone' && foco.inv === 'true', foco);
  await page.fill('#inputTelefone', '19999990001');
  await page.fill('#inputPlaca', 'AB');
  await page.evaluate(() => { document.getElementById('formAgendamento').requestSubmit(); });
  await page.waitForFunction(() => document.activeElement.id === 'inputPlaca');
  const foco2 = await page.evaluate(() => ({ id: document.activeElement.id, tel: document.getElementById('inputTelefone').getAttribute('aria-invalid'), placa: document.getElementById('inputPlaca').getAttribute('aria-invalid') }));
  t('corrigido o WhatsApp, a marca de erro sai dele e o foco vai para a placa', foco2.id === 'inputPlaca' && foco2.tel === null && foco2.placa === 'true', foco2);
  t('clicar no rótulo foca o campo', await (async () => { await page.click('label[for="inputPlaca"]'); return (await page.evaluate(() => document.activeElement.id)) === 'inputPlaca'; })());
  t('nenhuma violação de CSP em todo o fluxo', viol.length === 0, viol);
  await ctx.close();

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' TESTE(S) FALHARAM' : '\nTODOS OS TESTES DE ACESSIBILIDADE PASSARAM');
  process.exit(falhas ? 1 : 0);
})();
