// Testes do cadastro de postos: site e Apps Script com os mesmos textos/ids, e um posto novo (fora da Grande SP) funcionando de ponta a ponta.
// Uso: node tests/postos.test.js index.html [caminho/do/apps-script.gs]   (precisa do pacote "playwright" e do Chromium)
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const arquivo = path.resolve(process.argv[2] || 'index.html');
const raiz = path.dirname(arquivo);
const gsPath = process.argv[3] || process.env.APPS_SCRIPT_V32;
const html = fs.readFileSync(arquivo, 'utf8');
const H = {}; for (const h of JSON.parse(fs.readFileSync(path.join(raiz, 'vercel.json'), 'utf8')).headers[0].headers) H[h.key] = h.value;
let falhas = 0;
const t = (n, c, x) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + n + (c ? '' : ' -> ' + JSON.stringify(x))); if (!c) falhas++; };

const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8');
const CONFIG_NOVO = "const POSTOS_OUTROS = {\n  zz: { nome: \"Posto Teste Londrina - Rua X, 100, Centro, Londrina/PR (CEP 80000-000)\", curto: \"Posto Teste\", local: \"Londrina\", endereco: \"Rua X, 100 • Centro, Londrina/PR\", uf: \"PR\", cidades: [\"londrina\", \"sao jose dos pinhais\"] },\n";
function carregarSite(configExtra) {
  const cfg = configExtra ? ler('js/config.js').replace("const POSTOS_OUTROS = {\n", configExtra) : ler('js/config.js');
  const ctx = vm.createContext({});
  vm.runInContext(cfg.replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var') + '\n' + ler('js/feriados.js').replace(/\bconst\b/g, 'var') + '\nthis.__POSTOS = POSTOS; this.__COM_AGENDA = POSTOS_COM_AGENDA;', ctx);
  return ctx;
}

// ---------- 1) Regras do cadastro ----------
const base = carregarSite();
const todos = base.__POSTOS;
const ids = Object.keys(todos);
t('todo posto tem os campos obrigatórios e o CEP no nome', ids.every(id => ['nome', 'curto', 'local', 'endereco'].every(c => typeof todos[id][c] === 'string' && todos[id][c]) && /\(CEP \d{5}-\d{3}\)$/.test(todos[id].nome)), ids.filter(id => !/\(CEP \d{5}-\d{3}\)$/.test(todos[id].nome)));
t('ids e nomes não se repetem (nem com a Henricar)', new Set(ids.map(i => todos[i].nome).concat(base.POSTO_HENRICAR.nome)).size === ids.length + 1 && !ids.includes('henricar'));
t('todo posto de POSTOS_OUTROS tem uf e lista de cidades', Object.keys(base.POSTOS_OUTROS).every(id => /^[A-Z]{2}$/.test(base.POSTOS_OUTROS[id].uf) && Array.isArray(base.POSTOS_OUTROS[id].cidades) && base.POSTOS_OUTROS[id].cidades.length > 0));
t('todo posto aparece na agenda (POSTOS_COM_AGENDA)', ids.every(id => base.__COM_AGENDA.includes(todos[id].nome)) && base.__COM_AGENDA.includes(base.POSTO_HENRICAR.nome));
const idsFer = Object.keys(base.FERIADOS_MUNICIPAIS);
t('feriados municipais só citam postos que existem', idsFer.every(id => id === 'henricar' || ids.includes(id)), idsFer.filter(id => id !== 'henricar' && !ids.includes(id)));
const tabela = new Set(); for (const f of fs.readdirSync(path.join(raiz, 'dados/cobertura'))) for (const v of Object.values(JSON.parse(ler('dados/cobertura/' + f)))) v.split(',').forEach(x => tabela.add(x.split(':')[0]));
t('a tabela de tempo de carro só cita postos de POSTOS_SP', [...tabela].every(id => id in base.POSTOS_SP), [...tabela].filter(id => !(id in base.POSTOS_SP)));

// ---------- 2) Site x Apps Script ----------
if (gsPath && fs.existsSync(gsPath)) {
  const gs = vm.createContext({ Utilities: {}, SpreadsheetApp: {}, LockService: {}, CacheService: {}, ContentService: {}, Session: {}, Logger: {}, MailApp: {}, PropertiesService: {} });
  vm.runInContext(fs.readFileSync(gsPath, 'utf8') + '\nthis.__V = POSTOS_VALIDOS; this.__IDS = IDS_POSTOS_SP;', gs);
  const noSite = [base.POSTO_HENRICAR.nome].concat(ids.map(i => todos[i].nome));
  t('o Apps Script aceita exatamente os mesmos postos, com o mesmo texto', JSON.stringify(gs.__V) === JSON.stringify(noSite), { site: noSite.length, script: gs.__V.length, soNoSite: noSite.filter(n => !gs.__V.includes(n)).map(n => n.slice(0, 30)), soNoScript: gs.__V.filter(n => !noSite.includes(n)).map(n => n.slice(0, 30)) });
  t('os ids do Apps Script (feriados) estão na mesma ordem do site', JSON.stringify(gs.__IDS) === JSON.stringify(ids), { site: ids, script: gs.__IDS });
} else console.log('PULADO: informe o caminho do Apps Script (2º argumento) para conferir site x planilha.');

// ---------- 3) Posto novo, de ponta a ponta (posto de teste injetado só no navegador) ----------
async function novaPagina(browser, configExtra, viacep) {
  const ctx = await browser.newContext({ timezoneId: 'America/Sao_Paulo', locale: 'pt-BR', viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage(); const erros = []; const envios = [];
  page.on('pageerror', e => erros.push(String(e)));
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('script.google') && /salvar/.test(r.postData() || '')) envios.push(JSON.parse(r.postData())); });
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u === 'http://site.local/') return route.fulfill({ contentType: 'text/html', headers: H, body: html });
    if (u.includes('script.google.com')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: 'success', ocupados: [] }) });
    if (u.includes('viacep')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(viacep) });
    if (u.startsWith('http://site.local/')) {
      const p = path.join(raiz, new URL(u).pathname);
      if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'nao encontrado' });
      let corpo = fs.readFileSync(p);
      if (p.endsWith('js/config.js') && configExtra) corpo = corpo.toString().replace("const POSTOS_OUTROS = {\n", configExtra);
      const tipo = p.endsWith('.css') ? 'text/css' : p.endsWith('.json') ? 'application/json' : p.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript';
      return route.fulfill({ contentType: tipo, headers: H, body: corpo });
    }
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });
  return { page, ctx, erros, envios };
}
const consultar = async (page, cep) => {
  await page.goto('http://site.local/');
  await page.evaluate(() => window.selecionarServico('Instalação'));
  await page.fill('#inputCEP', cep);
  await page.evaluate(() => { window.buscarEAnalisarCEP(); });
  await page.waitForFunction(() => document.getElementById('cepFeedback').textContent.trim() !== '' && !document.getElementById('btnBuscarCep').disabled);
};
const vis = (page, id) => page.evaluate(i => !document.getElementById(i).classList.contains('hidden'), id);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const LONDRINA = { cep: '86010-000', logradouro: 'Rua Teste', bairro: 'Centro', localidade: 'Londrina', uf: 'PR' };

  // sem posto cadastrado: Londrina continua "ainda não atendemos"
  let r = await novaPagina(browser, null, LONDRINA);
  await consultar(r.page, '86010-000');
  t('sem posto cadastrado: Londrina/PR segue como "ainda não atendemos" (nada mudou)', (await vis(r.page, 'boxForaCobertura')) && !(await vis(r.page, 'boxPostosSP')));
  await r.ctx.close();

  // com posto cadastrado
  r = await novaPagina(browser, CONFIG_NOVO, LONDRINA);
  await consultar(r.page, '86010-000');
  const cartoes = await r.page.$$eval('#listaPostosSP button', bs => bs.map(b => ({ id: b.dataset.arg, texto: b.textContent.replace(/\s+/g, ' ') })));
  t('posto cadastrado em Londrina/PR aparece para CEP de Londrina', cartoes.length === 1 && cartoes[0].id === 'zz' && /Posto Teste/.test(cartoes[0].texto) && /atende Londrina/.test(cartoes[0].texto) && !/Mais próximo|min de carro/.test(cartoes[0].texto), cartoes);
  t('não mostra "fora da cobertura" nem técnico externo', !(await vis(r.page, 'boxForaCobertura')) && !(await vis(r.page, 'boxTecnicoExterno')));
  await r.page.click('#listaPostosSP button');
  await r.page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  await r.page.evaluate(() => window.selecionarHorario('09:00'));
  await r.page.fill('#inputNome', 'Maria da Silva'); await r.page.fill('#inputTelefone', '41999990001'); await r.page.fill('#inputPlaca', 'abc1d23');
  await r.page.evaluate(() => { document.getElementById('formAgendamento').requestSubmit(); });
  await r.page.waitForFunction(() => !document.getElementById('stepSucesso').classList.contains('hidden') || !document.getElementById('alertaConflito').classList.contains('hidden'));
  t('o agendamento envia o nome completo do novo posto para a planilha', r.envios.length === 1 && r.envios[0].posto === 'Posto Teste Londrina - Rua X, 100, Centro, Londrina/PR (CEP 80000-000)', r.envios[0] && r.envios[0].posto);
  t('fluxo do posto novo sem erros de JavaScript', r.erros.length === 0, r.erros);
  await r.ctx.close();

  // outra cidade/UF não é afetada (mesmo nome de cidade em outro estado)
  r = await novaPagina(browser, CONFIG_NOVO, Object.assign({}, LONDRINA, { uf: 'SC' }));
  await consultar(r.page, '86010-000');
  t('mesma cidade em outra UF não usa o posto (confere a UF)', (await vis(r.page, 'boxForaCobertura')) && !(await vis(r.page, 'boxPostosSP')));
  await r.ctx.close();

  r = await novaPagina(browser, CONFIG_NOVO, { cep: '13010-140', logradouro: 'Av Benjamin Constant', bairro: 'Centro', localidade: 'Campinas', uf: 'SP' });
  await consultar(r.page, '13010-140');
  t('Campinas segue indo para a Henricar com o posto novo cadastrado', await vis(r.page, 'boxPostosFixos'));
  await r.ctx.close();

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' TESTE(S) FALHARAM' : '\nTODOS OS TESTES DE POSTOS PASSARAM');
  process.exit(falhas ? 1 : 0);
})();
