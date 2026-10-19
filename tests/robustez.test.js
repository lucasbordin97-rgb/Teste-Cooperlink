// Robustez (sem internet): dados hostis, serviços externos falhando, clique duplo, armazenamento bloqueado,
// fusos e datas de borda, telas pequenas e um "macaco" que clica e digita ao acaso.
// Uso: node tests/robustez.test.js index.html   (precisa do pacote "playwright" e do Chromium)
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

const VIACEP = {
  '08391710': { logradouro: 'Rua Gabriel Garcia Marquez', bairro: 'Jd. Helena', localidade: 'São Paulo', uf: 'SP' },
  '13180000': { logradouro: 'Rua X', bairro: 'Y', localidade: 'Sumaré', uf: 'SP' },
  '13010140': { logradouro: 'Av. Benjamin Constant', bairro: 'Centro', localidade: 'Campinas', uf: 'SP' }
};
const OK = { json: { result: 'success' } };

async function responder(route, d) {
  if (d.abort) return route.abort();
  if (d.hang) return new Promise(() => {});
  if (d.status) return route.fulfill({ status: d.status, contentType: 'text/html', body: '<html><body>Erro do servidor</body></html>' });
  if (d.html) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Serviço indisponível</body></html>' });
  if (d.vazio) return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  if (d.texto !== undefined) return route.fulfill({ status: 200, contentType: 'application/json', body: d.texto });
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(d.json) });
}

async function novaPagina(browser, cfg) {
  cfg = cfg || {};
  const ctx = await browser.newContext({ timezoneId: cfg.tz || 'America/Sao_Paulo', locale: 'pt-BR', viewport: cfg.viewport || { width: 1280, height: 900 }, hasTouch: true });
  if (cfg.init) await ctx.addInitScript(cfg.init);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(cfg.clock || '2026-10-16T10:00:00-03:00') });
  const erros = []; const consoleErros = [];
  page.on('pageerror', e => erros.push(String(e)));
  page.on('console', m => {
    if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text());
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) consoleErros.push(m.text());
  });
  const envios = [];
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u === 'http://site.local/') return route.fulfill({ contentType: 'text/html', headers: H, body: html });
    if (u.includes('viacep.com.br')) {
      const cep = u.match(/ws\/(\d+)/)[1];
      const f = cfg.viacep || (c => ({ json: VIACEP[c] || { erro: true } }));
      return responder(route, f(cep));
    }
    if (u.includes('script.google.com')) {
      const corpo = JSON.parse(route.request().postData() || '{}');
      if (corpo.action === 'buscar') return responder(route, cfg.buscar ? cfg.buscar() : { json: { result: 'success', ocupados: [] } });
      envios.push(corpo);
      return responder(route, (cfg.script || (() => OK))(corpo, envios.length));
    }
    if (u.startsWith('http://site.local/dados/cobertura/') && cfg.shard) {
      const d = cfg.shard(new URL(u).pathname);
      if (d) return responder(route, d);
    }
    if (u.startsWith('http://site.local/')) {
      const p = path.join(raiz, new URL(u).pathname);
      if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'nao encontrado' });
      let corpo = fs.readFileSync(p);
      if (p.endsWith('js/config.js')) corpo = corpo.toString().replace(/USAR_TABELA_COBERTURA = (true|false)/, 'USAR_TABELA_COBERTURA = ' + (cfg.flag !== false));
      const tipo = p.endsWith('.css') ? 'text/css' : p.endsWith('.json') ? 'application/json' : 'application/javascript';
      return route.fulfill({ contentType: tipo, headers: H, body: corpo });
    }
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });
  return { page, ctx, erros, consoleErros, envios };
}

async function consultar(page, cep, esperar) {
  await page.goto('http://site.local/');
  await page.evaluate(() => window.selecionarServico('Instalação'));
  await page.fill('#inputCEP', cep);
  await page.evaluate(() => { window.buscarEAnalisarCEP(); });
  if (esperar !== false) await page.waitForFunction(() => document.getElementById('cepFeedback').innerText.trim() !== '' && !document.getElementById('btnBuscarCep').disabled);
}
async function ateFormulario(page, cep) {
  await consultar(page, cep || '08391-710');
  await page.click('#listaPostosSP button');
  await page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  await page.evaluate(() => window.selecionarHorario('09:00'));
}
const preencher = async (page, nome, tel, placa) => {
  await page.fill('#inputNome', nome || 'Maria da Silva');
  await page.fill('#inputTelefone', tel || '19999990001');
  await page.fill('#inputPlaca', placa || 'abc1d23');
};
const enviar = page => page.evaluate(() => { document.getElementById('formAgendamento').requestSubmit(); });
const visivel = (page, id) => page.evaluate(i => !document.getElementById(i).classList.contains('hidden'), id);
const erroForm = page => page.evaluate(() => document.getElementById('alertaConflito').classList.contains('hidden') ? null : document.getElementById('tituloErroForm').textContent);
const aguardarResultadoEnvio = page => page.waitForFunction(() => !document.getElementById('stepSucesso').classList.contains('hidden') || !document.getElementById('alertaConflito').classList.contains('hidden'));
const sucesso = page => visivel(page, 'stepSucesso');
const msgFeedback = page => page.evaluate(() => document.getElementById('cepFeedback').textContent.trim());
const botaoBuscaLivre = page => page.evaluate(() => !document.getElementById('btnBuscarCep').disabled && document.getElementById('btnBuscarCep').innerText.indexOf('Verificar') === 0);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  let r;

  // ================= 1) Dados hostis =================
  const hostil = { json: { localidade: '<img src=x onerror="window.__xss=1">', uf: 'SP' } };
  for (const flag of [true, false]) {
    r = await novaPagina(browser, { flag, viacep: () => hostil });
    await consultar(r.page, '13180-000');
    const x = await r.page.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('#cepFeedback img').length, texto: document.getElementById('cepFeedback').textContent }));
    t('cidade hostil do viaCEP (' + (flag ? 'regra nova' : 'regra antiga') + '): não executa código, não cria elemento e aparece só como texto', x.xss === undefined && x.imgs === 0 && !/[<>]/.test(x.texto) && /img src=x/.test(x.texto), x);
    t('cidade hostil: página sem erros de JavaScript', r.erros.length === 0, r.erros);
    await r.ctx.close();
  }
  r = await novaPagina(browser);
  await ateFormulario(r.page);
  await preencher(r.page, '<b>=SOMA(1)</b> Maria', '(19) 99999-0001', 'abc-1d23');
  await enviar(r.page); await aguardarResultadoEnvio(r.page);
  const p0 = r.envios[0] || {};
  t('nome com HTML/fórmula: o que vai para a planilha não tem < > nem começa com = + - @', r.envios.length === 1 && !/[<>]/.test(p0.nome) && !/^[=+\-@]/.test(p0.nome), p0.nome);
  t('placa com traço/minúsculas chega limpa (ABC1D23)', p0.placa === 'ABC1D23', p0.placa);
  const colado = await r.page.evaluate(() => {
    const f = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return el.value; };
    return { placa: f('inputPlaca', 'ABC-1D23'), cep: f('inputCEP', '13.010-140'), tel: f('inputTelefone', '+55 (19) 99999-0001') };
  });
  t('texto colado com símbolos não perde dígitos (placa, CEP, telefone com +55)', colado.placa === 'ABC1D23' && colado.cep === '13010-140' && colado.tel === '(19) 99999-0001', colado);
  await r.ctx.close();

  // ================= 2) viaCEP falhando =================
  const cenarios = [
    ['erro 500', { status: 500 }], ['resposta vazia', { vazio: true }], ['JSON quebrado', { texto: '<<<nao e json' }],
    ['página HTML', { html: true }], ['"null"', { texto: 'null' }], ['lista em vez de objeto', { texto: '[]' }], ['conexão cortada', { abort: true }]
  ];
  for (const [nome, d] of cenarios) {
    r = await novaPagina(browser, { flag: false, viacep: () => d });
    await consultar(r.page, '13180-000');
    t('viaCEP ' + nome + ': mostra "Oscilação na rede" e o botão volta a funcionar', /Oscilação na rede/.test(await msgFeedback(r.page)) && await botaoBuscaLivre(r.page) && r.erros.length === 0, { msg: await msgFeedback(r.page), erros: r.erros });
    await r.ctx.close();
  }
  r = await novaPagina(browser, { flag: false, viacep: () => ({ hang: true }) });
  await consultar(r.page, '13180-000', false);
  await r.page.clock.fastForward(8000);
  await r.page.waitForFunction(() => document.getElementById('cepFeedback').textContent.trim() !== '');
  t('viaCEP que nunca responde: depois de 7 s mostra o aviso e libera o botão', /Oscilação na rede/.test(await msgFeedback(r.page)) && await botaoBuscaLivre(r.page));
  await r.ctx.close();
  // com a regra nova, o CEP da Grande SP segue mesmo sem o viaCEP
  r = await novaPagina(browser, { viacep: () => ({ abort: true }) });
  await consultar(r.page, '08391-710');
  t('viaCEP fora do ar + CEP na nossa tabela: ainda mostra os postos', await visivel(r.page, 'boxPostosSP') && (await r.page.locator('#listaPostosSP button').count()) >= 1, await msgFeedback(r.page));
  t('endereço enviado nesse caso não fica vazio', await r.page.evaluate(() => /^CEP 08391-710/.test(estadoAgendamento.enderecoFormatado)), await r.page.evaluate(() => estadoAgendamento.enderecoFormatado));
  await r.ctx.close();
  r = await novaPagina(browser, { viacep: () => ({ abort: true }) });
  await consultar(r.page, '13180-000');
  t('viaCEP fora do ar + CEP que não está na tabela: aviso de rede (sem travar)', /Oscilação na rede/.test(await msgFeedback(r.page)) && await botaoBuscaLivre(r.page));
  await r.ctx.close();

  // ================= 3) tabela de cobertura falhando =================
  const shards = [['erro 500', () => ({ status: 500 })], ['JSON quebrado', () => ({ texto: '{"91710":' })], ['vazia', () => ({ json: {} })]];
  for (const [nome, f] of shards) {
    r = await novaPagina(browser, { shard: f });
    await consultar(r.page, '08391-710');
    t('tabela ' + nome + ': cai na regra antiga (técnico externo), sem erro', await visivel(r.page, 'boxTecnicoExterno') && !(await visivel(r.page, 'boxPostosSP')) && r.erros.length === 0, r.erros);
    await r.ctx.close();
  }
  r = await novaPagina(browser, { shard: p => p.endsWith('/083.json') ? { json: { '91710': 'zz:5,st:6,ho:900,la:abc' } } : null });
  await consultar(r.page, '08391-710');
  const lista = await r.page.evaluate(() => Array.from(document.querySelectorAll('#listaPostosSP button')).map(b => b.dataset.posto));
  t('tabela com posto desconhecido/valor estranho: só entra o que é válido (st)', JSON.stringify(lista) === '["st"]', lista);
  await r.ctx.close();

  // ================= 4) planilha (Apps Script) respondendo mal =================
  const respostasRuins = [
    ['página HTML (200)', () => ({ html: true })], ['erro 500 em HTML', () => ({ status: 500 })], ['corpo vazio', () => ({ vazio: true })],
    ['código desconhecido', () => ({ json: { result: 'algo_novo' } })], ['JSON sem result', () => ({ json: { ok: true } })]
  ];
  for (const [nome, f] of respostasRuins) {
    r = await novaPagina(browser, { script: f });
    await ateFormulario(r.page); await preencher(r.page);
    await enviar(r.page); await aguardarResultadoEnvio(r.page);
    t('planilha responde ' + nome + ': NÃO mostra "Tudo certo" e avisa o associado', !(await sucesso(r.page)) && (await erroForm(r.page)) !== null && !(await r.page.evaluate(() => document.getElementById('btnConfirmar').disabled)), { erro: await erroForm(r.page) });
    await r.ctx.close();
  }
  r = await novaPagina(browser, { script: (c, n) => n === 1 ? { abort: true } : OK });
  await ateFormulario(r.page); await preencher(r.page); await enviar(r.page); await aguardarResultadoEnvio(r.page);
  t('1ª tentativa sem resposta e a 2ª confirma: mostra sucesso (2 envios, lendo a resposta)', await sucesso(r.page) && r.envios.length === 2, r.envios.length);
  await r.ctx.close();
  r = await novaPagina(browser, { script: (c, n) => n === 1 ? { abort: true } : { json: { result: 'duplicate' } } });
  await ateFormulario(r.page); await preencher(r.page); await enviar(r.page); await aguardarResultadoEnvio(r.page);
  t('1ª sem resposta e a 2ª diz "duplicado": mostra o aviso verdadeiro, não sucesso', !(await sucesso(r.page)) && /já tem um agendamento/.test(await erroForm(r.page)), await erroForm(r.page));
  await r.ctx.close();
  r = await novaPagina(browser, { script: () => ({ abort: true }) });
  await ateFormulario(r.page); await preencher(r.page); await enviar(r.page); await aguardarResultadoEnvio(r.page);
  t('as duas tentativas sem resposta: "Sem conexão" e nada de sucesso', !(await sucesso(r.page)) && /Sem conexão/.test(await erroForm(r.page)) && r.envios.length === 2, { erro: await erroForm(r.page), n: r.envios.length });
  await r.ctx.close();
  r = await novaPagina(browser);
  await ateFormulario(r.page); await preencher(r.page);
  await r.page.evaluate(() => { const f = document.getElementById('formAgendamento'); f.requestSubmit(); f.requestSubmit(); f.requestSubmit(); });
  await aguardarResultadoEnvio(r.page);
  t('três envios no mesmo instante: só 1 vai para a planilha', r.envios.length === 1, r.envios.length);
  await r.ctx.close();
  r = await novaPagina(browser, { script: () => ({ html: true }) });
  await consultar(r.page, '13180-000');
  await r.page.fill('#interesseNome', 'João Souza'); await r.page.fill('#interesseTelefone', '19988887777'); await r.page.check('#interesseConsentimento');
  await r.page.evaluate(() => { document.getElementById('formInteresse').requestSubmit(); });
  await r.page.waitForFunction(() => !document.getElementById('interesseErro').classList.contains('hidden') || !document.getElementById('interesseSucesso').classList.contains('hidden'));
  t('pedido de contato com a planilha respondendo HTML: erro, não confirmação', await visivel(r.page, 'interesseErro') && !(await visivel(r.page, 'interesseSucesso')));
  await r.ctx.close();
  // busca de horários falhando não impede o agendamento
  r = await novaPagina(browser, { buscar: () => ({ html: true }) });
  await ateFormulario(r.page);
  t('sem conseguir ler os horários ocupados: ainda deixa escolher horário', await r.page.evaluate(() => estadoAgendamento.horario === '09:00'));
  await r.ctx.close();

  // ================= 5) navegador com restrições =================
  const bloqueio = "for (const k of ['localStorage','sessionStorage']) Object.defineProperty(window, k, { get() { throw new DOMException('bloqueado','SecurityError'); } });";
  r = await novaPagina(browser, { init: bloqueio });
  await ateFormulario(r.page); await preencher(r.page); await enviar(r.page); await aguardarResultadoEnvio(r.page);
  t('armazenamento do navegador bloqueado: o agendamento funciona do início ao fim', await sucesso(r.page) && r.erros.length === 0, r.erros);
  await r.ctx.close();
  r = await novaPagina(browser);
  await consultar(r.page, '08391-710');
  await r.page.reload();
  t('recarregar a página no meio: volta ao início sem erro', await visivel(r.page, 'step1') && !(await visivel(r.page, 'step2')) && r.erros.length === 0, r.erros);
  await r.ctx.close();

  // ================= 6) datas e fusos =================
  r = await novaPagina(browser, { tz: 'Pacific/Honolulu', clock: '2026-10-19T00:30:00-03:00' });
  await r.page.goto('http://site.local/');
  t('aparelho em outro fuso (Havaí, domingo à tarde): "hoje" é a data de Brasília (19/10)', (await r.page.evaluate(() => obterDataHojeBrasil())) === '2026-10-19' && (await r.page.getAttribute('#dataAgendamento', 'min')) === '2026-10-19');
  await r.ctx.close();
  r = await novaPagina(browser, { tz: 'Asia/Tokyo', clock: '2026-10-16T23:00:00-03:00' });
  await r.page.goto('http://site.local/');
  t('aparelho no Japão (já é sábado lá): "hoje" continua sendo sexta (16/10) em Brasília', (await r.page.evaluate(() => obterDataHojeBrasil())) === '2026-10-16');
  await r.ctx.close();
  r = await novaPagina(browser, { clock: '2026-10-16T17:30:00-03:00' });
  await r.page.goto('http://site.local/');
  t('sexta 17:30 (já passou o último horário): sugere segunda-feira (19/10)', (await r.page.inputValue('#dataAgendamento')) === '2026-10-19', await r.page.inputValue('#dataAgendamento'));
  await r.ctx.close();
  for (const [relogio, esperado] of [['2026-12-31T22:00:00-03:00', '2027-03-01'], ['2028-01-01T12:00:00-03:00', '2028-03-01'], ['2026-10-16T10:00:00-03:00', '2026-12-15']]) {
    r = await novaPagina(browser, { clock: relogio });
    await r.page.goto('http://site.local/');
    t('limite de 60 dias a partir de ' + relogio.slice(0, 10) + ' = ' + esperado, (await r.page.getAttribute('#dataAgendamento', 'max')) === esperado, await r.page.getAttribute('#dataAgendamento', 'max'));
    await r.ctx.close();
  }
  r = await novaPagina(browser, { clock: '2026-10-19T09:14:00-03:00' });
  await r.page.goto('http://site.local/');
  const regra = await r.page.evaluate(() => ({ nove: horarioJaPassouHoje('2026-10-19', '09:00'), nove30: horarioJaPassouHoje('2026-10-19', '09:30'), amanha: horarioJaPassouHoje('2026-10-20', '09:00') }));
  t('às 09:14: o horário das 09:00 já passou, o das 09:30 ainda vale (margem de 15 min) e o de amanhã vale', regra.nove === true && regra.nove30 === false && regra.amanha === false, regra);
  await r.ctx.close();

  // ================= 7) telas pequenas e grandes (sem rolagem lateral) =================
  const medir = page => page.evaluate(() => {
    const vw = window.innerWidth;
    const fora = [];
    document.querySelectorAll('body *').forEach(e => {
      if (e.classList.contains('skip-link')) return; // fica fora da tela de propósito até receber foco
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
      const b = e.getBoundingClientRect(); if (b.width === 0 || b.height === 0) return;
      if (b.right <= vw + 1 && b.left >= -1) return;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return; }
      fora.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]) + ' (' + Math.round(b.left) + '..' + Math.round(b.right) + ')');
    });
    return { vw, sw: document.documentElement.scrollWidth, fora: fora.slice(0, 4) };
  });
  for (const w of [320, 360, 390, 768, 1024, 1440]) {
    r = await novaPagina(browser, { viewport: { width: w, height: 800 } });
    const rel = [];
    await r.page.goto('http://site.local/'); rel.push(['início', await medir(r.page)]);
    await r.page.evaluate(() => window.selecionarServico('Instalação'));
    await r.page.fill('#inputCEP', '08391-710'); await r.page.evaluate(() => { window.buscarEAnalisarCEP(); });
    await r.page.waitForFunction(() => !document.getElementById('boxPostosSP').classList.contains('hidden')); rel.push(['postos', await medir(r.page)]);
    await r.page.click('#listaPostosSP button'); await r.page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden')); rel.push(['horários', await medir(r.page)]);
    await r.page.evaluate(() => window.selecionarHorario('09:00')); rel.push(['formulário', await medir(r.page)]);
    await preencher(r.page); await enviar(r.page); await aguardarResultadoEnvio(r.page); rel.push(['sucesso', await medir(r.page)]);
    await r.page.evaluate(() => { window.reiniciarFluxo(); window.selecionarServico('Instalação'); });
    await r.page.fill('#inputCEP', '13180-000'); await r.page.evaluate(() => { window.buscarEAnalisarCEP(); });
    await r.page.waitForFunction(() => !document.getElementById('boxForaCobertura').classList.contains('hidden')); rel.push(['fora da cobertura', await medir(r.page)]);
    const ruins = rel.filter(([, m]) => m.sw > m.vw + 1 || m.fora.length);
    t('largura ' + w + ' px: nenhuma etapa estoura a tela nem cria rolagem lateral', ruins.length === 0, ruins.map(([n, m]) => n + ': ' + m.sw + '>' + m.vw + ' ' + m.fora.join(', ')));
    await r.ctx.close();
  }

  // ================= 8) o "macaco": cliques, digitação e teclas ao acaso =================
  const rng = seed => { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; };
  const textos = ['', 'a', 'Maria da Silva', '19999990001', '13010-140', '08391-710', '13180-000', '<script>window.__x=1</script>', 'x'.repeat(3000), '😀🚗', 'ABC1D23', "'; DROP TABLE--", '١٢٣٤', ' ', '‮abc', '=1+1', '99999-999', '00000000'];
  const chaves = ['Tab', 'Shift+Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Space'];
  for (const seed of [11, 202, 3033]) {
    const dado = rng(seed);
    const sorteio = lista => lista[Math.floor(dado() * lista.length)];
    r = await novaPagina(browser, {
      viacep: c => { const q = dado(); return q < 0.15 ? { abort: true } : q < 0.25 ? { html: true } : { json: VIACEP[c] || (c.endsWith('0') ? { erro: true } : { localidade: sorteio(['Osasco', 'Santo André', 'Sumaré', 'Curitiba']), uf: 'SP', logradouro: 'Rua ' + sorteio(['A', 'B']) }) }; },
      script: () => { const q = dado(); return q < 0.55 ? OK : q < 0.65 ? { json: { result: 'conflict' } } : q < 0.72 ? { json: { result: 'duplicate' } } : q < 0.8 ? { html: true } : q < 0.88 ? { abort: true } : q < 0.94 ? { json: { result: 'busy' } } : { json: { result: 'invalid', campo: sorteio(['nome', 'telefone', 'placa', 'data']) } }; }
    });
    await r.page.goto('http://site.local/');
    let invariante = null; let acoes = 0;
    for (let i = 0; i < 220 && !invariante; i++) {
      const a = dado(); acoes++;
      try {
        if (a < 0.42) {
          await r.page.evaluate(q => { const els = Array.from(document.querySelectorAll('button, a[href^="#"], label, input[type=checkbox]')).filter(e => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && !e.disabled; }); if (els.length) els[Math.floor(q * els.length)].click(); }, dado());
        } else if (a < 0.72) {
          const v = sorteio(textos);
          await r.page.evaluate(([q, valor]) => { const els = Array.from(document.querySelectorAll('input:not([type=checkbox]):not(.hidden)')).filter(e => e.getBoundingClientRect().width > 0 && !e.classList.contains('hp-field')); if (!els.length) return; const e = els[Math.floor(q * els.length)]; e.focus(); e.value = valor; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [dado(), v]);
        } else if (a < 0.9) {
          await r.page.keyboard.press(sorteio(chaves));
        } else if (a < 0.95) {
          await r.page.setViewportSize({ width: 300 + Math.floor(dado() * 1100), height: 700 });
        } else {
          await r.page.clock.fastForward(1000 + Math.floor(dado() * 9000));
        }
        await r.page.waitForTimeout(8);
        const estado = await r.page.evaluate(() => ({
          visiveis: ['step1', 'step2', 'step3', 'step4', 'stepSucesso'].filter(id => !document.getElementById(id).classList.contains('hidden')).length,
          atuais: document.querySelectorAll('.rota-no.is-current').length,
          xss: window.__x
        }));
        if (estado.visiveis !== 1) invariante = 'etapas visíveis = ' + estado.visiveis;
        if (estado.atuais !== 1) invariante = 'etapas atuais na barra = ' + estado.atuais;
        if (estado.xss !== undefined) invariante = 'script injetado executou';
      } catch (e) { invariante = 'ação falhou: ' + String(e).slice(0, 100); }
    }
    t('macaco (semente ' + seed + ', ' + acoes + ' ações): sempre 1 etapa visível, 1 etapa atual, sem script injetado', !invariante, invariante);
    t('macaco (semente ' + seed + '): zero erros de JavaScript e zero erros no console', r.erros.length === 0 && r.consoleErros.length === 0, { erros: r.erros.slice(0, 3), console: r.consoleErros.slice(0, 3) });
    await r.ctx.close();
  }

  t('nenhuma violação da política de segurança (CSP) em toda a bateria', viol.length === 0, viol.slice(0, 3));
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' TESTE(S) FALHARAM' : '\nTODOS OS TESTES DE ROBUSTEZ PASSARAM');
  process.exit(falhas ? 1 : 0);
})();
