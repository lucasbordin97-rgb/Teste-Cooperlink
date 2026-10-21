// Testes do técnico parceiro: prazo de 5 dias úteis, entorno de Campinas (Claudemir) e a pergunta "consegue ir ao posto?" em Campinas/Hortolândia.
// Uso: node tests/tecnico.test.js index.html   (precisa do pacote "playwright" e do Chromium)
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const arquivo = path.resolve(process.argv[2] || 'index.html');
const raiz = path.dirname(arquivo);
const html = fs.readFileSync(arquivo, 'utf8');
const H = {}; for (const h of JSON.parse(fs.readFileSync(path.join(raiz, 'vercel.json'), 'utf8')).headers[0].headers) H[h.key] = h.value;
let falhas = 0;
const t = (n, c, x) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + n + (c ? '' : ' -> ' + JSON.stringify(x))); if (!c) falhas++; };

const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8');

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

// ---------- 1) Prazo em dias úteis (sem navegador) ----------
const ctx = vm.createContext({});
vm.runInContext([ler('js/config.js'), ler('js/feriados.js'), ler('js/agenda.js')].join('\n').replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var') +
  '\nthis.__prazo = prazoTecnico; this.__texto = textoPrazoTecnico; this.__rot = rotuloDiaCurto; this.__util = ehDiaUtilGeral;', ctx);
const prazo = d => { const p = ctx.__prazo(d); return p.inicio + ' a ' + p.fim; };
t('terça 20/10/2026: começa na quarta 21/10 e vai até terça 27/10', prazo('2026-10-20') === '2026-10-21 a 2026-10-27', prazo('2026-10-20'));
t('sexta 23/10: começa na segunda 26/10 e vai até sexta 30/10', prazo('2026-10-23') === '2026-10-26 a 2026-10-30', prazo('2026-10-23'));
t('sábado 24/10 e domingo 25/10: começa na segunda 26/10', prazo('2026-10-24') === '2026-10-26 a 2026-10-30' && prazo('2026-10-25') === '2026-10-26 a 2026-10-30');
t('sexta 30/10: pula o fim de semana e Finados (02/11); começa em 03/11 e vai até 09/11', prazo('2026-10-30') === '2026-11-03 a 2026-11-09', prazo('2026-10-30'));
t('véspera de Natal: 23/12 começa em 24/12, pula 25/12, vai até 31/12', prazo('2026-12-23') === '2026-12-24 a 2026-12-31', prazo('2026-12-23'));
t('virada de ano: 31/12/2026 começa em 04/01/2027 (01/01 é feriado) e vai até 08/01', prazo('2026-12-31') === '2027-01-04 a 2027-01-08', prazo('2026-12-31'));
t('Carnaval (ponto facultativo) conta como dia sem expediente: 13/02/2026 começa em 18/02', prazo('2026-02-13') === '2026-02-18 a 2026-02-24', prazo('2026-02-13'));
t('feriado de cidade e 9 de julho NÃO entram na conta (técnico não tem posto)', ctx.__util('2026-07-09') === true && ctx.__util('2027-07-14') === true);
t('rótulo curto e texto da mensagem', ctx.__rot('2026-10-21') === 'qua, 21/10' && ctx.__texto('2026-10-20') === 'Um técnico parceiro da Cooperlink entrará em contato com você em até 5 dias úteis (de qua, 21/10 a ter, 27/10) para combinar a melhor data e horário.', ctx.__texto('2026-10-20'));

async function novaPaginaTec(browser, viacep) { return novaPagina(browser, null, viacep); }
async function preencherEEnviar(page) {
  await page.fill('#inputNome', 'Maria da Silva'); await page.fill('#inputTelefone', '19999990001'); await page.fill('#inputPlaca', 'abc1d23');
  // técnico externo: rua e número do veículo são obrigatórios (a rua já vem do CEP)
  if (await page.evaluate(() => !document.getElementById('blocoEnderecoVeiculo').classList.contains('hidden'))) await page.fill('#inputNumero', '123');
  await page.evaluate(() => { document.getElementById('formAgendamento').requestSubmit(); });
  await page.waitForFunction(() => !document.getElementById('stepSucesso').classList.contains('hidden') || !document.getElementById('alertaConflito').classList.contains('hidden'));
}
const via = (cidade, uf, cep) => ({ cep: cep, logradouro: 'Rua Teste', bairro: 'Centro', localidade: cidade, uf: uf });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

  // ---------- 2) Entorno de Campinas: vai direto para o técnico ----------
  for (const [cidade, cep] of [['Limeira', '13480-000'], ["Santa Bárbara D'Oeste", '13450-000'], ['Artur Nogueira', '13160-000'], ['Atibaia', '12940-000']]) {
    const r = await novaPaginaTec(browser, via(cidade, 'SP', cep));
    await consultar(r.page, cep);
    t(cidade + '/SP: vai para o técnico parceiro (não é "fora da cobertura")', (await vis(r.page, 'boxTecnicoExterno')) && !(await vis(r.page, 'boxForaCobertura')) && !(await vis(r.page, 'boxPostosFixos')));
    await r.ctx.close();
  }
  let r = await novaPaginaTec(browser, via('Limeira', 'PR', '13480-000'));
  await consultar(r.page, '13480-000');
  t('Limeira em outra UF não usa a regra do entorno de Campinas', (await vis(r.page, 'boxForaCobertura')) && !(await vis(r.page, 'boxTecnicoExterno')));
  await r.ctx.close();

  // técnico do entorno: envia, mostra o prazo e esconde o texto do WhatsApp; sem motivo
  r = await novaPaginaTec(browser, via('Limeira', 'SP', '13480-000'));
  await consultar(r.page, '13480-000');
  await r.page.click('#boxTecnicoExterno button');
  await r.page.waitForFunction(() => !document.getElementById('step4').classList.contains('hidden'));
  const end = await r.page.evaluate(() => ({ visivel: !document.getElementById('blocoEnderecoVeiculo').classList.contains('hidden'), rua: document.getElementById('inputRua').value, bairro: document.getElementById('inputBairro').value, numero: document.getElementById('inputNumero').value, obrig: document.getElementById('inputRua').required && document.getElementById('inputNumero').required }));
  t('técnico: aparece o endereço do veículo, com rua e bairro vindos do CEP e número vazio e obrigatório', end.visivel && end.rua === 'Rua Teste' && end.bairro === 'Centro' && end.numero === '' && end.obrig, end);
  await r.page.fill('#inputNome', 'Maria da Silva'); await r.page.fill('#inputTelefone', '19999990001'); await r.page.fill('#inputPlaca', 'abc1d23');
  await r.page.evaluate(() => window.finalizarAgendamento({ preventDefault() {} }));   // sem a validação nativa do navegador, para testar a nossa mensagem
  t('técnico sem número: não envia e avisa', r.envios.length === 0 && await r.page.evaluate(() => !document.getElementById('alertaConflito').classList.contains('hidden') && /número/i.test(document.getElementById('msgErroForm').innerText)), r.envios);
  await r.page.fill('#inputRua', '   '); await r.page.fill('#inputNumero', '123');
  await r.page.evaluate(() => window.finalizarAgendamento({ preventDefault() {} }));
  t('técnico sem rua: não envia e avisa', r.envios.length === 0 && await r.page.evaluate(() => /rua/i.test(document.getElementById('msgErroForm').innerText)), r.envios);
  await r.page.fill('#inputRua', 'Rua das Palmeiras'); await r.page.fill('#inputBairro', 'Jardim Azul'); await r.page.fill('#inputComplemento', 'portão azul');
  await preencherEEnviar(r.page);
  t('técnico: o endereço enviado é o que o associado informou (rua, número, bairro, cidade/UF e complemento)', r.envios.length === 1 && r.envios[0].endereco === 'Rua das Palmeiras, 123 - Jardim Azul, Limeira/SP - Compl.: portão azul', r.envios[0] && r.envios[0].endereco);
  const msg = await r.page.evaluate(() => ({ tec: !document.getElementById('blocoTecnicoSucesso').classList.contains('hidden'), zap: !document.getElementById('blocoWhatsAppSucesso').classList.contains('hidden'), texto: document.getElementById('textoPrazoTecnico').textContent }));
  t('técnico: tela de sucesso mostra o prazo de 5 dias úteis e esconde o texto do WhatsApp', msg.tec && !msg.zap && /em até 5 dias úteis \(de \w{3}, \d\d\/\d\d a \w{3}, \d\d\/\d\d\)/.test(msg.texto), msg);
  t('técnico do entorno: envia posto de técnico, data "A agendar via técnico" e motivo vazio', r.envios.length === 1 && /^Agend\. Tecnico Parceiro - CEP: 13480-000$/.test(r.envios[0].posto) && r.envios[0].data === 'A agendar via técnico' && r.envios[0].motivo === '', r.envios[0]);
  t('fluxo do técnico sem erros de JavaScript', r.erros.length === 0, r.erros);
  await r.ctx.close();

  // ---------- 3) Campinas/Hortolândia: "consegue ir ao posto?" ----------
  for (const [cidade, cep] of [['Campinas', '13010-140'], ['Hortolândia', '13184-000']]) {
    r = await novaPaginaTec(browser, via(cidade, 'SP', cep));
    await consultar(r.page, cep);
    t(cidade + ': aparece a pergunta e o posto Henricar; a caixa de motivo começa fechada', (await vis(r.page, 'boxPostosFixos')) && !(await vis(r.page, 'boxMotivoNaoVai')) && /consegue ir até a unidade Henricar/.test(await r.page.textContent('#boxPostosFixos')));
    await r.ctx.close();
  }
  // não consegue: exige motivo
  r = await novaPaginaTec(browser, via('Campinas', 'SP', '13010-140'));
  await consultar(r.page, '13010-140');
  await r.page.click('[data-click="abrirMotivoSemPosto"]');
  t('"Não consigo ir" abre a caixa de motivo', await vis(r.page, 'boxMotivoNaoVai'));
  await r.page.click('[data-click="confirmarTecnicoCampinas"]');
  t('sem motivo não avança e avisa', (await vis(r.page, 'erroMotivoSemPosto')) && !(await vis(r.page, 'step4')));
  await r.page.fill('#inputMotivoSemPosto', '<b>Sem carro</b> até sexta');
  await r.page.click('[data-click="confirmarTecnicoCampinas"]');
  await r.page.waitForFunction(() => !document.getElementById('step4').classList.contains('hidden'));
  const resumo = await r.page.evaluate(() => document.getElementById('resumoModalidade').innerText);
  t('com motivo: o resumo NÃO diz que será técnico (o setor analisa antes)', /nosso setor/.test(resumo) && !/t[ée]cnico|externo/i.test(resumo), resumo);
  t('com motivo: o botão não promete técnico', !/t[ée]cnico/i.test(await r.page.evaluate(() => document.querySelector('[data-click="confirmarTecnicoCampinas"]').innerText)));
  await preencherEEnviar(r.page);
  const msgMotivo = await r.page.evaluate(() => document.getElementById('textoPrazoTecnico').innerText);
  t('com motivo: a tela de sucesso diz que foi enviado ao setor e que entraremos em contato, sem falar de técnico nem de prazo', /enviada ao nosso setor/.test(msgMotivo) && /entraremos em contato para confirmar/.test(msgMotivo) && !/t[ée]cnico|dias [úu]teis/i.test(msgMotivo), msgMotivo);
  t('com motivo: envia técnico + motivo (sem < >)', r.envios.length === 1 && /^Agend\. Tecnico Parceiro - CEP: 13010-140$/.test(r.envios[0].posto) && !/[<>]/.test(r.envios[0].motivo) && /Sem carro/.test(r.envios[0].motivo) && r.envios[0].isTecnicoExterno === true, r.envios[0]);
  t('campinas sem posto: tela de sucesso é a do técnico', await r.page.evaluate(() => !document.getElementById('blocoTecnicoSucesso').classList.contains('hidden')));
  t('fluxo do motivo sem erros de JavaScript', r.erros.length === 0, r.erros);
  await r.ctx.close();

  // consegue ir: segue para a Henricar, sem motivo
  r = await novaPaginaTec(browser, via('Campinas', 'SP', '13010-140'));
  await consultar(r.page, '13010-140');
  await r.page.click('[data-click="abrirMotivoSemPosto"]');
  await r.page.fill('#inputMotivoSemPosto', 'motivo qualquer escrito antes de mudar de ideia');
  await r.page.click('#boxPostosFixos button[data-click="confirmarPostoParceiro"]');
  await r.page.waitForFunction(() => !document.getElementById('containerHorarios').classList.contains('hidden'));
  await r.page.evaluate(() => window.selecionarHorario('09:00'));
  t('posto: o endereço do veículo NÃO aparece e não é obrigatório', await r.page.evaluate(() => document.getElementById('blocoEnderecoVeiculo').classList.contains('hidden') && !document.getElementById('inputRua').required && !document.getElementById('inputNumero').required));
  await preencherEEnviar(r.page);
  t('posto: o endereço enviado continua sendo o do CEP', r.envios.length === 1 && /^Rua Teste, Centro - /.test(r.envios[0].endereco), r.envios[0] && r.envios[0].endereco);
  t('quem escolhe o posto depois de escrever um motivo NÃO envia motivo', r.envios.length === 1 && /^Henricar/.test(r.envios[0].posto) && r.envios[0].motivo === '' && r.envios[0].isTecnicoExterno === false, r.envios[0]);
  t('posto: tela de sucesso continua com o texto do WhatsApp', await r.page.evaluate(() => !document.getElementById('blocoWhatsAppSucesso').classList.contains('hidden') && document.getElementById('blocoTecnicoSucesso').classList.contains('hidden')));
  await r.ctx.close();

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' TESTE(S) FALHARAM' : '\nTODOS OS TESTES DO TÉCNICO PASSARAM');
  process.exit(falhas ? 1 : 0);
})();
