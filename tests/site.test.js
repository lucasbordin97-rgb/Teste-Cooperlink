// Testes do site (sem internet): simulam viaCEP, Apps Script e Tailwind.
// Uso: node tests/site.test.js index.html   (precisa do pacote "playwright" e do Chromium)
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs');
const arquivo = path.resolve(process.argv[2] || 'index.html');
const html = fs.readFileSync(arquivo, 'utf8');
const H = {}; for (const h of JSON.parse(fs.readFileSync(path.join(path.dirname(arquivo), 'vercel.json'),'utf8')).headers[0].headers) H[h.key]=h.value;
const viol = [];
let falhas = 0;
const t = (n, c, x) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + n + (c ? '' : ' -> ' + JSON.stringify(x))); if (!c) falhas++; };
const POSTO = 'Henricar - Av. Benjamin Constant, 550, Campinas/SP (CEP 13010-140)';

async function novaPagina(browser, cfg) {
  const ctx = await browser.newContext({ timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-10-16T10:00:00-03:00') });
  page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text()); });
  const erros = []; page.on('pageerror', e => erros.push(String(e)));
  const envios = [];
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u === 'http://site.local/') return route.fulfill({ contentType: 'text/html', headers: H, body: html });
    if (u.includes('viacep.com.br')) {
      const cep = u.match(/ws\/(\d+)/)[1];
      const mapa = { '13010140': { logradouro: 'Av. Benjamin Constant', bairro: 'Centro', localidade: 'Campinas', uf: 'SP' },
                     '13180000': { logradouro: 'Rua X', bairro: 'Y', localidade: 'Sumaré', uf: 'SP' },
                     '01001000': { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' } };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(mapa[cep] || { erro: true }) });
    }
    if (u.includes('script.google.com')) {
      const corpo = JSON.parse(route.request().postData() || '{}');
      if (corpo.action === 'buscar') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: 'success', ocupados: cfg.ocupados || [] }) });
      envios.push(corpo);
      if (cfg.falhaRede) return route.abort();
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(cfg.resposta || { result: 'success' }) });
    }
    if (u.startsWith('http://site.local/') && u !== 'http://site.local/') {
      const p = path.join(path.dirname(arquivo), new URL(u).pathname);
      if (fs.existsSync(p)) return route.fulfill({ contentType: p.endsWith('.css') ? 'text/css' : 'application/javascript', headers: H, body: p.endsWith('js/config.js') ? fs.readFileSync(p, 'utf8').replace(/USAR_TABELA_COBERTURA = (true|false)/, 'USAR_TABELA_COBERTURA = false') : fs.readFileSync(p) });
      return route.fulfill({ status: 404, body: 'nao encontrado' });
    }
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind = {};' });
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' }); // fontes/imagens
  });
  return { page, ctx, erros, envios };
}

async function irAteFormulario(page, horario) {
  await page.goto('http://site.local/');
  await page.evaluate(() => window.selecionarServico('Instalação'));
  await page.fill('#inputCEP', '13010-140');
  await page.evaluate(() => window.buscarEAnalisarCEP());
  await page.waitForFunction(() => !document.getElementById('boxPostosFixos').classList.contains('hidden'));
  await page.evaluate(p => window.confirmarPostoParceiro(p), POSTO);
  await page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  await page.evaluate(h => window.selecionarHorario(h), horario);
  await page.fill('#inputNome', 'Maria da Silva');
  await page.fill('#inputTelefone', '19999990001');
  await page.fill('#inputPlaca', 'abc1d23');
}
const visivel = (page, id) => page.evaluate(i => !document.getElementById(i).classList.contains('hidden'), id);
const msgErro = page => page.evaluate(() => document.getElementById('alertaConflito').classList.contains('hidden') ? null : document.getElementById('tituloErroForm').textContent + ' | ' + document.getElementById('msgErroForm').textContent);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

  // 1) carregamento e area restrita
  let { page, ctx, erros } = await novaPagina(browser, {});
  await page.goto('http://site.local/');
  t('pagina carrega sem erros de JavaScript', erros.length === 0, erros);
  const admin = await page.evaluate(() => ({ modal: !!document.getElementById('modalAdmin'), login: !!document.getElementById('modalAdminLogin'), fn: typeof window.toggleAdminLogin, fn2: typeof window.verificarSenha, texto: document.documentElement.outerHTML.includes('cooperlink2026') || document.documentElement.outerHTML.includes('4c708e7f') }));
  t('area restrita removida (sem modais, funcoes, senha ou hash)', !admin.modal && !admin.login && admin.fn === 'undefined' && admin.fn2 === 'undefined' && !admin.texto, admin);
  await page.click('#logoAdminTrigger').catch(() => {});
  await page.locator('header h1').click({ clickCount: 3 });
  t('tres cliques no logo nao abrem nada', (await page.locator('input[type=password]').count()) === 0);
  await ctx.close();

  // 2) fluxo normal com sucesso, ocupados com posto
  let r = await novaPagina(browser, { ocupados: [{ data: '2026-10-19', horario: '09:00', posto: POSTO }, { data: '2026-10-19', horario: '09:30' }, { data: '2026-10-19', horario: '10:00', posto: 'Outro Posto Qualquer' }] });
  await irAteFormulario(r.page, '13:00');
  const estadoData = await r.page.evaluate(() => estadoAgendamento.data);
  t('data inicial e hoje (sexta 16/10, 10:00) ou proximo dia util', ['2026-10-16', '2026-10-19'].includes(estadoData), estadoData);
  await r.page.evaluate(() => { document.getElementById('dataAgendamento').value = '2026-10-19'; window.aoMudarDataManual(); });
  await r.page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  const grade = await r.page.evaluate(() => Array.from(document.querySelectorAll('#gridHorariosManha button, #gridHorariosTarde button')).map(b => b.innerText + ':' + (b.disabled ? 'x' : 'ok')).join(' '));
  t('09:00 (mesmo posto) bloqueado', grade.includes('09:00:x'), grade);
  t('09:30 (versao antiga, sem posto) bloqueado por seguranca', grade.includes('09:30:x'), grade);
  t('10:00 (posto desconhecido) bloqueado por seguranca', grade.includes('10:00:x'), grade);
  t('10:30 livre', grade.includes('10:30:ok'), grade);
  await r.page.evaluate(() => window.selecionarHorario('13:00'));
  await r.page.fill('#inputNome', 'Maria da Silva'); await r.page.fill('#inputTelefone', '19999990001'); await r.page.fill('#inputPlaca', 'abc1d23');
  await r.page.evaluate(() => document.getElementById('formAgendamento').requestSubmit());
  await r.page.waitForFunction(() => !document.getElementById('stepSucesso').classList.contains('hidden'));
  t('sucesso: mostra tela "Tudo Certo"', true);
  t('enviou 1 pedido com posto e horario', r.envios.length === 1 && r.envios[0].posto === POSTO && r.envios[0].horario === '13:00', r.envios);
  const ls = await r.page.evaluate(() => localStorage.getItem('agendamentos_db'));
  t('navegador guarda so data/horario/posto (sem nome, telefone, placa)', ls && !/Maria|9999|ABC1D23|telefone|placa|nome/i.test(ls), ls);
  t('sem erros de JavaScript no fluxo', r.erros.length === 0, r.erros);
  await r.ctx.close();

  // 3) respostas de recusa
  const casos = [
    [{ result: 'conflict' }, /Esgotado/],
    [{ result: 'rate_limited' }, /Muitos agendamentos/],
    [{ result: 'busy' }, /Sistema ocupado/],
    [{ result: 'error' }, /Sistema ocupado/],
    [{ result: 'invalid', campo: 'placa' }, /Placa inválida/],
    [{ result: 'invalid', campo: 'data' }, /indisponível/],
    [{ result: 'invalid', campo: 'cep' }, /não conferem/],
  ];
  for (const [resp, re] of casos) {
    r = await novaPagina(browser, { resposta: resp });
    await irAteFormulario(r.page, '14:00');
    await r.page.evaluate(() => document.getElementById('formAgendamento').requestSubmit());
    await r.page.waitForFunction(() => !document.getElementById('alertaConflito').classList.contains('hidden'));
    const m = await msgErro(r.page); const sucesso = await visivel(r.page, 'stepSucesso'); const btn = await r.page.evaluate(() => !document.getElementById('btnConfirmar').disabled);
    t('resposta ' + JSON.stringify(resp) + ' -> mensagem de erro, sem "Tudo Certo", botao liberado', re.test(m) && !sucesso && btn, { m, sucesso, btn });
    await r.ctx.close();
  }

  // 4) sem internet no envio
  r = await novaPagina(browser, { falhaRede: true });
  await irAteFormulario(r.page, '14:00');
  await r.page.evaluate(() => document.getElementById('formAgendamento').requestSubmit());
  await r.page.waitForFunction(() => !document.getElementById('alertaConflito').classList.contains('hidden'), null, { timeout: 15000 });
  const mr = await msgErro(r.page);
  t('sem rede: avisa o associado e NAO mostra sucesso', /Sem conexão/.test(mr) && !(await visivel(r.page, 'stepSucesso')), mr);
  await r.ctx.close();

  // 5) resposta de versao antiga do script (sem campo "posto" e sem novos codigos) continua funcionando
  r = await novaPagina(browser, { resposta: { result: 'success' }, ocupados: [{ data: '2026-10-19', horario: '11:00' }] });
  await irAteFormulario(r.page, '15:00');
  await r.page.evaluate(() => document.getElementById('formAgendamento').requestSubmit());
  await r.page.waitForFunction(() => !document.getElementById('stepSucesso').classList.contains('hidden'));
  t('script antigo (sem posto nos ocupados) + site novo: agenda normalmente', true);
  await r.ctx.close();

  // 6) tecnico externo (Sumare) e Sao Paulo (ainda tecnico externo nesta rodada)
  for (const [cep, rotulo] of [['13180-000', 'Sumaré'], ['01001-000', 'São Paulo']]) {
    r = await novaPagina(browser, {});
    await r.page.goto('http://site.local/');
    await r.page.evaluate(() => window.selecionarServico('Manutenção'));
    await r.page.fill('#inputCEP', cep);
    await r.page.evaluate(() => window.buscarEAnalisarCEP());
    await r.page.waitForFunction(() => !document.getElementById('boxTecnicoExterno').classList.contains('hidden'));
    await r.page.evaluate(() => window.encaminharParaTecnicoParceiro());
    await r.page.fill('#inputNome', 'João Souza'); await r.page.fill('#inputTelefone', '11988887777'); await r.page.fill('#inputPlaca', 'XYZ9K88');
    await r.page.evaluate(() => document.getElementById('formAgendamento').requestSubmit());
    await r.page.waitForFunction(() => !document.getElementById('stepSucesso').classList.contains('hidden'));
    const e = r.envios[0];
    t(rotulo + ': tecnico externo, data "A agendar via técnico"', e && e.data === 'A agendar via técnico' && e.isTecnicoExterno === true, e);
    const ls2 = await r.page.evaluate(() => localStorage.getItem('agendamentos_db'));
    t(rotulo + ': tecnico externo nao grava reserva no navegador', !ls2 || ls2 === '[]', ls2);
    await r.ctx.close();
  }

  // 7) limpeza de dados pessoais antigos no navegador
  r = await novaPagina(browser, {});
  await r.page.addInitScript(() => {
    localStorage.setItem('agendamentos_db', JSON.stringify([{ nome: 'Fulano', telefone: '(19) 99999-9999', placa: 'AAA1A11', data: '2026-10-19', horario: '10:00', posto: 'P' }]));
    localStorage.setItem('google_script_url', 'https://exemplo');
  });
  await r.page.goto('http://site.local/');
  const apos = await r.page.evaluate(() => ({ db: localStorage.getItem('agendamentos_db'), url: localStorage.getItem('google_script_url') }));
  t('dados antigos: nome/telefone/placa apagados, data/horario mantidos', apos.db && !/Fulano|9999|AAA1A11/.test(apos.db) && /2026-10-19/.test(apos.db) && apos.url === null, apos);
  await r.ctx.close();

  // 8) janela de 60 dias
  r = await novaPagina(browser, {});
  await irAteFormulario(r.page, '14:00');
  await r.page.evaluate(() => { document.getElementById('dataAgendamento').value = '2027-03-01'; window.aoMudarDataManual(); });
  t('data alem de 60 dias mostra aviso', await visivel(r.page, 'avisoDataForaJanela') && !(await visivel(r.page, 'containerHorarios')));
  const max = await r.page.evaluate(() => document.getElementById('dataAgendamento').max);
  t('calendario limitado a 60 dias (max=2026-12-15)', max === '2026-12-15', max);
  await r.ctx.close();

  // 9) LGPD e seguranca basica do HTML
  r = await novaPagina(browser, {});
  await r.page.goto('http://site.local/');
  t('aviso LGPD presente no formulario', (await r.page.evaluate(() => document.getElementById('formAgendamento').innerText)).includes('LGPD'));
  await r.ctx.close();

  t('nenhuma violacao de CSP em todo o fluxo', viol.length===0, viol.slice(0,5));
  await browser.close();
  console.log(falhas === 0 ? '\nTODOS OS TESTES DO SITE PASSARAM' : '\n' + falhas + ' FALHA(S)');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });