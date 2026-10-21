// Testes da cobertura por tempo de carro (USAR_TABELA_COBERTURA ligado), sem internet.
// Usa as tabelas reais de dados/cobertura e simula viaCEP e Apps Script.
// Uso: node tests/cobertura.test.js index.html   (precisa do pacote "playwright" e do Chromium)
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

// CEPs de teste (a cidade vem do "viaCEP" simulado; a tabela vem do arquivo real).
const VIACEP = {
  '08391710': { logradouro: 'Rua Gabriel Garcia Marquez', bairro: 'Jd. Helena', localidade: 'São Paulo', uf: 'SP' },      // Stop System, perto
  '08840220': { logradouro: 'Estrada X', bairro: 'Y', localidade: 'Mogi das Cruzes', uf: 'SP' },                           // Grande SP, passa de 30 min
  '06650000': { logradouro: '', bairro: '', localidade: 'Itapevi', uf: 'SP' },                                              // Grande SP, CEP fora da base do IBGE
  '14400000': { logradouro: 'Rua X', bairro: 'Y', localidade: 'Franca', uf: 'SP' },                                         // fora da cobertura
  '90010000': { logradouro: 'Rua X', bairro: 'Y', localidade: 'Porto Alegre', uf: 'RS' },                                   // fora da cobertura, sem arquivo de tabela
  '58675000': { logradouro: '', bairro: '', localidade: 'Santo André', uf: 'PB' },                                          // mesmo nome de cidade da Grande SP, em outro estado
  '99999001': { logradouro: '', bairro: '', localidade: 'Campinas', uf: 'PB' },                                             // mesmo nome de Campinas, em outro estado
  '13010140': { logradouro: 'Av. Benjamin Constant', bairro: 'Centro', localidade: 'Campinas', uf: 'SP' }                  // Henricar, regra antiga
};
const STOP = 'Stop System - Rua Rio de Janeiro, 346 - Jardim Oratório, Mauá/SP (CEP 09381-050)';

async function novaPagina(browser, cfg) {
  cfg = cfg || {};
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
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(VIACEP[cep] || { erro: true }) });
    }
    if (u.includes('script.google.com')) {
      const corpo = JSON.parse(route.request().postData() || '{}');
      if (corpo.action === 'buscar') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: 'success', ocupados: [] }) });
      envios.push(corpo);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(cfg.resposta || { result: 'success' }) });
    }
    if (u.startsWith('http://site.local/dados/cobertura/') && cfg.tabelaForaDoAr) return route.fulfill({ status: 500, body: 'erro' });
    if (u.startsWith('http://site.local/')) {
      const p = path.join(raiz, new URL(u).pathname);
      if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: 'nao encontrado' });
      let corpo = fs.readFileSync(p);
      if (p.endsWith('js/config.js')) corpo = corpo.toString().replace(/USAR_TABELA_COBERTURA = (true|false)/, 'USAR_TABELA_COBERTURA = ' + (cfg.flagLigada !== false));
      const tipo = p.endsWith('.css') ? 'text/css' : p.endsWith('.json') ? 'application/json' : 'application/javascript';
      return route.fulfill({ contentType: tipo, headers: H, body: corpo });
    }
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind = {};' });
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });
  return { page, ctx, erros, envios };
}

async function consultar(page, cep) {
  await page.goto('http://site.local/');
  await page.evaluate(() => window.selecionarServico('Instalação'));
  await page.fill('#inputCEP', cep);
  await page.evaluate(() => window.buscarEAnalisarCEP());
  await page.waitForFunction(() => document.getElementById('cepFeedback').innerText.trim() !== '' && !document.getElementById('btnBuscarCep').disabled);
}
const visivel = (page, id) => page.evaluate(i => !document.getElementById(i).classList.contains('hidden'), id);
const caixas = async page => ({
  postosSP: await visivel(page, 'boxPostosSP'), tecnico: await visivel(page, 'boxTecnicoExterno'),
  fora: await visivel(page, 'boxForaCobertura'), henricar: await visivel(page, 'boxPostosFixos')
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

  // 1) Grande SP perto de um posto: mostra o posto certo e o associado agenda
  let { page, ctx, erros, envios } = await novaPagina(browser);
  await consultar(page, '08391-710');
  let c = await caixas(page);
  t('Grande SP perto: mostra os postos e nenhuma outra caixa', c.postosSP && !c.tecnico && !c.fora && !c.henricar, c);
  const lista = await page.evaluate(() => Array.from(document.querySelectorAll('#listaPostosSP button')).map(b => ({ id: b.dataset.arg, minutos: Number(b.dataset.minutos), texto: b.innerText, rotulo: b.getAttribute('aria-label') })));
  t('o posto mais próximo (Stop System) vem primeiro, na ordem do tempo de carro', lista.length >= 1 && lista[0].id === 'st' && lista.every((p, i) => i === 0 || p.minutos >= lista[i - 1].minutos), lista);
  t('nenhum posto listado passa de 30 minutos', lista.every(p => p.minutos > 0 && p.minutos <= 30), lista);
  t('o tempo de carro NÃO aparece para o associado (nem no texto, nem no rótulo de leitor de tela)', lista.every(p => !/min|carro|\d+\s*minutos/i.test(p.texto.replace(/MAIS PRÓXIMO/i, '')) && !/min|carro/i.test(p.rotulo)), lista);
  t('o cartão não tem mais o traço "Você ○ - - 📍"', await page.evaluate(() => !document.querySelector('#listaPostosSP .trajeto') && Array.from(document.querySelectorAll('#listaPostosSP button')).every(b => !/^\s*Você/.test(b.innerText))));
  t('o selo "Mais próximo" continua só no primeiro', /mais pr[óo]ximo/i.test(lista[0].texto) && lista.slice(1).every(p => !/mais pr[óo]ximo/i.test(p.texto)), lista);
  await page.click('#listaPostosSP button[data-arg="st"]');
  await page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  t('escolher o posto leva à data e horário, sem marcar técnico externo', await page.evaluate(() => estadoAgendamento.isTecnicoExterno === false && estadoAgendamento.posto.nome.indexOf('Stop System') === 0));
  await page.evaluate(() => window.selecionarHorario('09:00'));
  await page.fill('#inputNome', 'Maria da Silva');
  await page.fill('#inputTelefone', '11999990001');
  await page.fill('#inputPlaca', 'abc1d23');
  await page.evaluate(() => document.getElementById('formAgendamento').requestSubmit());
  await page.waitForFunction(() => !document.getElementById('stepSucesso').classList.contains('hidden'));
  t('agendamento no posto grava o nome do posto, sem técnico externo', envios.length === 1 && envios[0].posto === STOP && envios[0].isTecnicoExterno === false && envios[0].horario === '09:00', envios);
  t('página sem erros de JavaScript', erros.length === 0, erros);
  await ctx.close();

  // 1b) Placa que já tem agendamento ativo (o Apps Script responde "duplicate")
  ({ page, ctx, envios } = await novaPagina(browser, { resposta: { result: 'duplicate' } }));
  await consultar(page, '08391-710');
  await page.click('#listaPostosSP button[data-arg="st"]');
  await page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  await page.evaluate(() => window.selecionarHorario('09:30'));
  await page.fill('#inputNome', 'Maria da Silva');
  await page.fill('#inputTelefone', '11999990001');
  await page.fill('#inputPlaca', 'abc1d23');
  await page.evaluate(() => document.getElementById('formAgendamento').requestSubmit());
  await page.waitForFunction(() => !document.getElementById('alertaConflito').classList.contains('hidden'));
  const tituloDup = await page.evaluate(() => document.getElementById('tituloErroForm').textContent + ' | ' + document.getElementById('msgErroForm').textContent);
  t('placa já agendada: avisa o associado (24 horas / telefone) e NÃO mostra sucesso', /já tem um agendamento/.test(tituloDup) && /24 horas/.test(tituloDup) && !(await visivel(page, 'stepSucesso')), tituloDup);
  t('placa já agendada: o botão de confirmar volta a ficar livre', await page.evaluate(() => !document.getElementById('btnConfirmar').disabled));
  t('placa já agendada: a reserva não fica guardada no navegador', await page.evaluate(() => (localStorage.getItem('agendamentos_db') || '').indexOf('09:30') === -1));
  await ctx.close();

  // 2) Grande SP acima de 30 minutos: técnico externo
  ({ page, ctx } = await novaPagina(browser));
  await consultar(page, '08840-220');
  c = await caixas(page);
  t('Grande SP acima de 30 min: técnico externo (nenhum posto)', c.tecnico && !c.postosSP && !c.fora, c);
  await ctx.close();

  // 3) CEP da Grande SP que não está na base do IBGE: cidade decide, técnico externo
  ({ page, ctx } = await novaPagina(browser));
  await consultar(page, '06650-000');
  c = await caixas(page);
  t('CEP da Grande SP fora da base: técnico externo pela cidade (Itapevi)', c.tecnico && !c.postosSP && !c.fora, c);
  await ctx.close();

  // 4) Fora da cobertura: pedido de contato com consentimento
  ({ page, ctx, envios } = await novaPagina(browser));
  await consultar(page, '14400-000');
  c = await caixas(page);
  t('Franca (fora da cobertura): mostra o pedido de contato, não o técnico', c.fora && !c.tecnico && !c.postosSP, c);
  await page.fill('#interesseNome', 'João Souza');
  await page.fill('#interesseTelefone', '19988887777');
  await page.evaluate(() => document.getElementById('formInteresse').requestSubmit());
  t('sem marcar o consentimento, nada é enviado', envios.length === 0 && await visivel(page, 'interesseErro'), envios);
  await page.check('#interesseConsentimento');
  await page.evaluate(() => document.getElementById('formInteresse').requestSubmit());
  await page.waitForFunction(() => !document.getElementById('interesseSucesso').classList.contains('hidden'));
  const e = envios[0] || {};
  t('com consentimento: envia a ação "interesse" com CEP, cidade, UF e consentimento', envios.length === 1 && e.action === 'interesse' && e.cep === '14400-000' && e.cidade === 'Franca' && e.uf === 'SP' && e.consentimento === true && e.nome === 'João Souza', envios);
  t('mostra a confirmação e esconde o formulário', await visivel(page, 'interesseSucesso') && !(await visivel(page, 'formInteresse')));
  await ctx.close();

  // 5) Outro estado, sem arquivo de tabela (404): também é fora da cobertura
  ({ page, ctx } = await novaPagina(browser));
  await consultar(page, '90010-000');
  c = await caixas(page);
  t('outro estado: fora da cobertura', c.fora && !c.tecnico, c);
  await ctx.close();

  // 5b) Cidade com o mesmo nome de uma da Grande SP / de Campinas, mas em outro estado: fora da cobertura
  ({ page, ctx } = await novaPagina(browser));
  await consultar(page, '58675-000');
  c = await caixas(page);
  t('Santo André/PB (mesmo nome de Santo André/SP): fora da cobertura, NÃO técnico nem posto de SP', c.fora && !c.tecnico && !c.postosSP && !c.henricar, c);
  await ctx.close();
  ({ page, ctx } = await novaPagina(browser));
  await consultar(page, '99999-001');
  c = await caixas(page);
  t('Campinas/PB (mesmo nome de Campinas/SP): fora da cobertura, NÃO Henricar', c.fora && !c.henricar && !c.tecnico && !c.postosSP, c);
  await ctx.close();

  // 6) Campinas continua na Henricar (regra antiga), sem consultar a tabela
  let consultouTabela = false;
  ({ page, ctx } = await novaPagina(browser));
  page.on('request', r => { if (r.url().includes('dados/cobertura')) consultouTabela = true; });
  await consultar(page, '13010-140');
  c = await caixas(page);
  t('Campinas: Henricar, igual a antes', c.henricar && !c.postosSP && !c.fora && !c.tecnico && !consultouTabela, { c, consultouTabela });
  await ctx.close();

  // 7) Tabela fora do ar: volta para a regra antiga, sem erro para o associado
  ({ page, ctx, erros } = await novaPagina(browser, { tabelaForaDoAr: true }));
  await consultar(page, '08391-710');
  c = await caixas(page);
  t('tabela fora do ar: cai na regra antiga (técnico externo), sem erros', c.tecnico && !c.postosSP && !c.fora && erros.length === 0, { c, erros });
  await ctx.close();

  // 8) Chave desligada: nada muda e a tabela nem é consultada
  consultouTabela = false;
  ({ page, ctx } = await novaPagina(browser, { flagLigada: false }));
  page.on('request', r => { if (r.url().includes('dados/cobertura')) consultouTabela = true; });
  await consultar(page, '08391-710');
  c = await caixas(page);
  t('chave desligada: regra antiga e a tabela não é consultada', c.tecnico && !c.postosSP && !c.fora && !consultouTabela, { c, consultouTabela });
  await ctx.close();

  t('nenhuma violação de CSP em todo o fluxo', viol.length === 0, viol);
  await browser.close();
  console.log(falhas ? '\n' + falhas + ' TESTE(S) FALHARAM' : '\nTODOS OS TESTES DE COBERTURA PASSARAM');
  process.exit(falhas ? 1 : 0);
})();
