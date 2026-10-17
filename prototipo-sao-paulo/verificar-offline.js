// Confere a logica do teste com respostas simuladas (sem internet e sem chave). Nao mede precisao real.
const fs = require('fs'), os = require('os'), path = require('path');
const { principal } = require('./teste.js');
const assert = require('assert');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-'));
const POSTOS = { 'Posto Oeste': [-46.70, -23.52], 'Posto Leste': [-46.40, -23.50], 'Posto Longe': [-47.50, -22.90] };
fs.writeFileSync(path.join(pasta, 'postos.json'), JSON.stringify(Object.keys(POSTOS).map(n => ({ nome: n, endereco: n }))));
fs.writeFileSync(path.join(pasta, 'ceps.txt'), ['# comentario', '01000-000;perto do oeste', '08000000;perto do leste', '99999-999', '09999000', '07777000', ''].join('\n'));
const DADOS = { // viaCEP + coordenadas simuladas
  '01000000': { v: { logradouro: 'Rua A', bairro: 'Lapa', localidade: 'Sao Paulo', uf: 'SP' }, aw: [-46.69, -23.53], ors: [-46.69, -23.53] },
  '08000000': { v: { logradouro: 'Rua B', bairro: 'Leste', localidade: 'Sao Paulo', uf: 'SP' }, aw: [-46.41, -23.51], ors: [-46.55, -23.50] }, // A e B divergem de proposito
  '99999999': { erro: true },
  '09999000': { v: { logradouro: 'Rua C', bairro: 'Centro', localidade: 'Campinas', uf: 'SP' }, aw: null, ors: null }, // sem coordenada
  '07777000': { v: { logradouro: 'Rua D', bairro: 'Distante', localidade: 'Piracicaba', uf: 'SP' }, aw: [-47.65, -22.73], ors: [-47.65, -22.73] }, // longe de tudo? (perto do Posto Longe)
};
let chamadas = 0;
const r = (obj, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(obj) });
const distKm = (a, b) => Math.hypot((a[0] - b[0]) * 102, (a[1] - b[1]) * 111);
async function falso(url, op = {}) {
  chamadas++;
  if (url.includes('viacep.com.br')) { const c = url.match(/ws\/(\d+)/)[1]; return r(DADOS[c] ? (DADOS[c].erro ? { erro: true } : DADOS[c].v) : { erro: true }); }
  if (url.includes('awesomeapi')) { const c = url.match(/json\/(\d+)/)[1]; const d = DADOS[c]; return d && d.aw ? r({ lat: String(d.aw[1]), lng: String(d.aw[0]) }) : r({}, 404); }
  if (url.includes('/geocode/search')) {
    assert.ok(op.headers && op.headers.Authorization === 'CHAVE_FALSA', 'chave deve ir no cabecalho');
    assert.ok(!url.includes('CHAVE_FALSA'), 'chave nao pode ir na URL');
    const t = decodeURIComponent(url.split('text=')[1]);
    if (POSTOS[t]) return r({ features: [{ geometry: { coordinates: POSTOS[t] }, properties: { confidence: 1 } }] });
    const achado = Object.values(DADOS).find(d => d.v && t.includes(d.v.logradouro));
    return r({ features: achado && achado.ors ? [{ geometry: { coordinates: achado.ors }, properties: { confidence: 0.8 } }] : [] });
  }
  if (url.includes('/matrix/')) {
    const b = JSON.parse(op.body), o = b.locations[0], ds = b.destinations.map(i => b.locations[i]);
    return r({ durations: [ds.map(d => distKm(o, d) * 2.5 * 60)], distances: [ds.map(d => distKm(o, d) * 1.3 * 1000)] });
  }
  throw new Error('URL inesperada ' + url);
}
(async () => {
  const log = console.log; console.log = () => {};
  const saida = await principal({ fetchFn: falso, chave: 'CHAVE_FALSA', pasta, pausa: 0 });
  console.log = log;
  const lin = saida.slice(1).map(l => l.split(';'));
  const por = c => lin.find(l => l[0] === c);
  assert.strictEqual(lin.length, 5, 'cinco CEPs');
  assert.strictEqual(por('01000000')[3], 'Posto Oeste'); assert.strictEqual(por('01000000')[6], 'perto');
  assert.strictEqual(por('01000000')[12], 'perto do oeste', 'opiniao preservada');
  assert.ok(por('08000000')[11].includes('tempos divergem') || por('08000000')[11].includes('postos diferentes'), 'divergencia sinalizada');
  assert.ok(por('99999999')[11].includes('viaCEP'), 'CEP inexistente tratado');
  assert.ok(por('09999000')[11].includes('sem coordenada'), 'sem coordenada sinalizado');
  assert.strictEqual(por('09999000')[6], 'tecnico', 'sem dados vira tecnico externo');
  assert.strictEqual(por('07777000')[3], 'Posto Longe');
  const antes = chamadas; // segunda rodada deve usar o cache e nao chamar nada
  await principal({ fetchFn: falso, chave: 'CHAVE_FALSA', pasta, pausa: 0 });
  assert.strictEqual(chamadas, antes, 'cache evita chamadas repetidas');
  assert.ok(!fs.readFileSync(path.join(pasta, 'cache.json'), 'utf8').includes('CHAVE_FALSA'), 'chave nao vai para o cache');
  console.log('OK: logica do teste verificada offline (6 conferencias).');
})().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
