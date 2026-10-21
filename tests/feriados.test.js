// Testes dos dias sem atendimento (feriados): regra do site, igualdade com o Apps Script v3.2 e comportamento na tela.
// Uso: node tests/feriados.test.js index.html [caminho/do/apps-script-v3.2.gs]   (precisa do pacote "playwright" e do Chromium)
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

// ---------- 1) Regra do site (sem navegador) ----------
const ctxSite = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(raiz, 'js/config.js'), 'utf8').replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var') +
  '\n' + fs.readFileSync(path.join(raiz, 'js/feriados.js'), 'utf8').replace(/\bconst\b/g, 'var'), ctxSite);
const site = (d, nome) => ctxSite.nomeDoFeriado(d, nome);
const HENR = ctxSite.POSTO_HENRICAR.nome, P = id => ctxSite.POSTOS_SP[id].nome;
const ids = Object.keys(ctxSite.POSTOS_SP);
t('Sexta-feira Santa: 03/04/2026 e 26/03/2027', site('2026-04-03', HENR) === 'Sexta-feira Santa' && site('2027-03-26', P('h7')) === 'Sexta-feira Santa');
t('Carnaval: 16 e 17/02/2026; 08 e 09/02/2027', /Carnaval/.test(site('2026-02-16', HENR)) && /Carnaval/.test(site('2026-02-17', HENR)) && /Carnaval/.test(site('2027-02-08', HENR)) && /Carnaval/.test(site('2027-02-09', HENR)));
t('Corpus Christi: 04/06/2026 e 27/05/2027', /Corpus/.test(site('2026-06-04', HENR)) && /Corpus/.test(site('2027-05-27', HENR)));
t('Páscoa 2028 (16/04): Sexta-feira Santa em 14/04/2028', site('2028-04-14', HENR) === 'Sexta-feira Santa');
t('feriados nacionais valem para todos os postos', ['2026-11-02', '2026-11-20', '2026-12-25', '2026-09-07', '2027-01-01', '2026-07-09'].every(d => [HENR].concat(ids.map(P)).every(n => !!site(d, n))));
t('feriado de cidade só vale no posto da cidade (14/07 Campinas; 25/01 São Paulo)', !!site('2027-07-14', HENR) && !site('2027-07-14', P('h7')) && !!site('2027-01-25', P('h7')) && !!site('2027-01-25', P('jp')) && !site('2027-01-25', HENR) && !site('2027-01-25', P('gc')));
t('cada cidade tem o seu: Mauá 08/12, SBC 20/08, Suzano 20/01, Carapicuíba 26/03, Arujá 08/06', !!site('2026-12-08', P('st')) && !site('2026-12-08', P('h7')) && !!site('2026-08-20', P('gc')) && !!site('2027-01-20', P('ex')) && !!site('2027-03-26', P('ca')) && !!site('2026-06-08', P('ar')));
t('dia comum não é feriado', ['2026-10-20', '2026-11-03', '2026-12-01'].every(d => !site(d, HENR) && !site(d, P('h7'))));
t('entradas estranhas não quebram (vazio, texto, posto desconhecido)', site('', HENR) === null && site('abc', HENR) === null && site(undefined, HENR) === null && site('2026-11-03', 'Posto Fantasma') === null && !!site('2026-11-02', 'Posto Fantasma'));
ctxSite.FECHAMENTOS_AVULSOS.h7 = { '2026-12-24': 'Inventário' };
t('fechamento avulso vale só para o posto indicado', site('2026-12-24', P('h7')) === 'Inventário' && !site('2026-12-24', P('la')));
delete ctxSite.FECHAMENTOS_AVULSOS.h7;

// Feriados ESTADUAIS por UF: 09/07 só em SP; 24/06 e 02/07 só na BA; PR, SC, MG e MT sem feriado estadual em dia útil.
const nomeDe = id => ctxSite.POSTOS[id].nome;
const idsFora = Object.keys(ctxSite.POSTOS_OUTROS);
const daUF = uf => idsFora.filter(id => ctxSite.POSTOS_OUTROS[id].uf === uf).map(nomeDe);
t('os postos novos cobrem SP, PR, SC, MG, MT e BA', ['SP', 'PR', 'SC', 'MG', 'MT', 'BA'].every(uf => daUF(uf).length > 0), ['SP', 'PR', 'SC', 'MG', 'MT', 'BA'].map(uf => uf + ':' + daUF(uf).length));
t('9 de julho (Revolução Constitucionalista) vale em SP, inclusive nos postos novos do interior', !!site('2026-07-09', HENR) && daUF('SP').every(n => !!site('2026-07-09', n)));
t('9 de julho NÃO vale fora de SP (PR, SC, MG, MT, BA)', ['PR', 'SC', 'MG', 'MT', 'BA'].every(uf => daUF(uf).every(n => !site('2026-07-09', n))));
t('Bahia: 24/06 e 02/07 são feriado só nos postos da BA', daUF('BA').every(n => !!site('2026-06-24', n) && !!site('2026-07-02', n)) && !site('2026-06-24', HENR) && !site('2026-07-02', HENR) && daUF('PR').every(n => !site('2026-07-02', n)));
t('UF lida do nome do posto', ctxSite.ufDoPosto(HENR) === 'SP' && daUF('BA').every(n => ctxSite.ufDoPosto(n) === 'BA') && daUF('MT').every(n => ctxSite.ufDoPosto(n) === 'MT') && ctxSite.ufDoPosto(undefined) === 'SP');
t('feriados nacionais continuam valendo nos postos de todos os estados', ['2026-11-02', '2026-11-20', '2026-12-25', '2026-09-07', '2027-01-01'].every(d => [HENR].concat(Object.keys(ctxSite.POSTOS).map(nomeDe)).every(n => !!site(d, n))));

// ---------- 2) Mesma regra no Apps Script v3.3 ----------
if (gsPath && fs.existsSync(gsPath)) {
  const ctxGs = vm.createContext({ Utilities: {}, SpreadsheetApp: {}, LockService: {}, CacheService: {}, ContentService: {}, Session: {}, Logger: {}, MailApp: {}, PropertiesService: {} });
  vm.runInContext(fs.readFileSync(gsPath, 'utf8'), ctxGs);
  const todos = [HENR].concat(Object.keys(ctxSite.POSTOS).map(nomeDe));
  let dif = [], total = 0;
  for (const nome of todos) for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2029, 0, 1); ms += 86400000) {
    const d = new Date(ms).toISOString().slice(0, 10); total++;
    const a = site(d, nome), b = ctxGs.nomeDoFeriado(d, nome);
    if ((a || null) !== (b || null)) dif.push([d, nome.slice(0, 12), a, b]);
  }
  t('Apps Script e site concordam em ' + total + ' combinações (' + todos.length + ' postos x 2026-2028)', dif.length === 0, dif.slice(0, 3));
} else console.log('PULADO: informe o caminho do apps-script-v3.2.gs (2º argumento) para conferir site x planilha.');

// ---------- 3) Na tela ----------
async function novaPagina(browser) {
  const ctx = await browser.newContext({ timezoneId: 'America/Sao_Paulo', locale: 'pt-BR', viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  const erros = []; page.on('pageerror', e => erros.push(String(e)));
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u === 'http://site.local/') return route.fulfill({ contentType: 'text/html', headers: H, body: html });
    if (u.includes('script.google.com')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: 'success', ocupados: [] }) });
    if (u.includes('viacep')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ cep: '08391-710', localidade: 'São Paulo', uf: 'SP' }) });
    if (u.startsWith('http://site.local/')) {
      const p = path.join(raiz, new URL(u).pathname);
      if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'nao encontrado' });
      const tipo = p.endsWith('.css') ? 'text/css' : p.endsWith('.json') ? 'application/json' : p.endsWith('.svg') ? 'image/svg+xml' : 'application/javascript';
      return route.fulfill({ contentType: tipo, headers: H, body: fs.readFileSync(p) });
    }
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });
  return { page, ctx, erros };
}
async function ateHorarios(page, idPosto) {
  await page.goto('http://site.local/');
  await page.evaluate(() => window.selecionarServico('Instalação'));
  await page.fill('#inputCEP', '08391-710');
  await page.evaluate(() => { window.buscarEAnalisarCEP(); });
  await page.waitForFunction(() => document.querySelectorAll('#listaPostosSP button').length > 0);
  await page.click('#listaPostosSP button[data-arg="' + idPosto + '"]');
  await page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
}
const visivel = (page, id) => page.evaluate(i => !document.getElementById(i).classList.contains('hidden'), id);
const livres = page => page.evaluate(() => Array.from(document.querySelectorAll('#containerHorarios .slot-btn')).filter(b => !b.disabled).length);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

  // sexta 30/10/2026 às 22h: hoje já encerrou, sábado/domingo fecham e segunda 02/11 é Finados -> terça 03/11
  let { page, ctx, erros } = await novaPagina(browser);
  await page.clock.setFixedTime(new Date('2026-10-30T22:00:00-03:00'));
  await ateHorarios(page, 'st');
  const data1 = await page.inputValue('#dataAgendamento');
  t('sexta à noite: pula fim de semana e o feriado de Finados (02/11) e abre em 03/11', data1 === '2026-11-03', data1);
  t('na data certa há horários livres', (await livres(page)) > 0);

  // escolher o feriado à mão
  await page.fill('#dataAgendamento', '2026-11-02');
  await page.dispatchEvent('#dataAgendamento', 'change');
  t('escolher 02/11 (Finados) à mão: avisa o motivo e esconde os horários', (await visivel(page, 'avisoFeriado')) && /Finados/.test(await page.textContent('#avisoFeriado')) && !(await visivel(page, 'containerHorarios')), await page.textContent('#avisoFeriado'));
  await page.fill('#dataAgendamento', '2026-11-03');
  await page.dispatchEvent('#dataAgendamento', 'change');
  await page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  t('voltar para dia normal: aviso some e horários voltam', !(await visivel(page, 'avisoFeriado')) && (await livres(page)) > 0);

  t('página sem erros de JavaScript', erros.length === 0, erros);
  await ctx.close();

  // feriado só de uma cidade: 08/12 é feriado em Mauá (st) e dia normal em outro posto.
  // O site só agenda até 14 dias à frente, então o relógio fica em 01/12 para o dia 08/12 estar dentro da janela.
  ({ page, ctx, erros } = await novaPagina(browser));
  await page.clock.setFixedTime(new Date('2026-12-01T10:00:00-03:00'));
  await ateHorarios(page, 'st');
  await page.fill('#dataAgendamento', '2026-12-08');
  await page.dispatchEvent('#dataAgendamento', 'change');
  t('Mauá: 08/12 bloqueado (aniversário da cidade)', (await visivel(page, 'avisoFeriado')) && /Mauá/.test(await page.textContent('#avisoFeriado')));
  t('página sem erros de JavaScript (Mauá)', erros.length === 0, erros);
  await ctx.close();

  ({ page, ctx, erros } = await novaPagina(browser));
  await page.clock.setFixedTime(new Date('2026-12-01T10:00:00-03:00'));
  await ateHorarios(page, 'ho');
  await page.fill('#dataAgendamento', '2026-12-08');
  await page.dispatchEvent('#dataAgendamento', 'change');
  await page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  t('São Mateus (SP): 08/12 é dia normal', !(await visivel(page, 'avisoFeriado')) && (await livres(page)) > 0);
  t('sem erros de JavaScript', erros.length === 0, erros);
  await ctx.close();

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' TESTE(S) FALHARAM' : '\nTODOS OS TESTES DE FERIADOS PASSARAM');
  process.exit(falhas ? 1 : 0);
})();
