// Teste isolado: tempo de carro do CEP do associado ate cada posto. NAO faz parte do site.
// Uso:  ORS_API_KEY=suachave node teste.js        (Node 18 ou mais novo, sem instalar nada)
// Entradas: postos.json e ceps.txt.  Saidas: resultado.csv e cache.json.
const fs = require('fs');
const path = require('path');

const CONFIG = {
  faixaPertoMin: 25,    // ate aqui: so agendamento no posto
  faixaMediaMin: 40,    // ate aqui: associado escolhe posto ou tecnico; acima: tecnico externo
  linhaRetaMaxKm: 40,   // acima disso nem consulta tempo de carro
  divergenciaMin: 5,    // diferenca entre metodos A e B que merece atencao
  pausaMs: 1600,        // respeita o limite por minuto do plano gratuito
};

const aqui = f => path.join(__dirname, f);
const dormir = ms => new Promise(r => setTimeout(r, ms));
const limparCep = s => String(s).replace(/\D/g, '').padStart(8, '0');
const km = (a, b) => { // distancia em linha reta (haversine); a e b = [lon, lat]
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function criarServicos(fetchFn, chaveOrs, cache, salvarCache) {
  async function json(url, opcoes, tentativas = 3) {
    for (let i = 0; i < tentativas; i++) {
      const r = await fetchFn(url, opcoes);
      if (r.status === 429) { await dormir(8000 * (i + 1)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + url.split('?')[0]);
      return r.json();
    }
    throw new Error('Limite de requisicoes (429) em ' + url.split('?')[0]);
  }
  async function comCache(chave, fn) {
    if (cache[chave] !== undefined) return cache[chave];
    cache[chave] = await fn(); salvarCache(); return cache[chave];
  }
  const cab = { Authorization: chaveOrs, 'Content-Type': 'application/json' };
  return {
    viacep: cep => comCache('viacep:' + cep, () => json('https://viacep.com.br/ws/' + cep + '/json/')),
    awesome: cep => comCache('awesome:' + cep, async () => {
      try {
        const d = await json('https://cep.awesomeapi.com.br/json/' + cep);
        const lat = parseFloat(d.lat), lng = parseFloat(d.lng);
        return isFinite(lat) && isFinite(lng) ? { coord: [lng, lat] } : { coord: null };
      } catch (e) { return { coord: null, erro: e.message }; }
    }),
    geocodificar: texto => comCache('ors-geo:' + texto, async () => {
      try {
        const d = await json('https://api.openrouteservice.org/geocode/search?size=1&boundary.country=BR&text=' + encodeURIComponent(texto), { headers: cab });
        const f = d.features && d.features[0];
        return f ? { coord: f.geometry.coordinates, confianca: f.properties && f.properties.confidence } : { coord: null };
      } catch (e) { return { coord: null, erro: e.message }; }
    }),
    tempos: (origem, destinos) => comCache('ors-matrix:' + origem.join(',') + '>' + destinos.map(d => d.join(',')).join('|'), async () => {
      const corpo = { locations: [origem].concat(destinos), sources: [0], destinations: destinos.map((_, i) => i + 1), metrics: ['duration', 'distance'] };
      const d = await json('https://api.openrouteservice.org/v2/matrix/driving-car', { method: 'POST', headers: cab, body: JSON.stringify(corpo) });
      return { minutos: d.durations[0].map(s => s == null ? null : s / 60), km: d.distances[0].map(m => m == null ? null : m / 1000) };
    }),
  };
}

async function melhorPosto(servicos, origem, postos) {
  if (!origem) return { posto: '-', min: null, km: null, nota: 'sem coordenada' };
  const retas = postos.map(p => km(origem, p.coord));
  if (Math.min(...retas) > CONFIG.linhaRetaMaxKm) return { posto: '-', min: null, km: Math.min(...retas), nota: 'longe demais (linha reta)' };
  const t = await servicos.tempos(origem, postos.map(p => p.coord));
  let melhor = -1;
  t.minutos.forEach((m, i) => { if (m != null && (melhor < 0 || m < t.minutos[melhor])) melhor = i; });
  if (melhor < 0) return { posto: '-', min: null, km: null, nota: 'sem rota' };
  return { posto: postos[melhor].nome, min: Math.round(t.minutos[melhor]), km: Math.round(t.km[melhor] * 10) / 10, nota: '' };
}

const faixa = min => min == null ? 'tecnico' : min <= CONFIG.faixaPertoMin ? 'perto' : min <= CONFIG.faixaMediaMin ? 'media' : 'tecnico';

async function principal({ fetchFn, chave, pasta, pausa }) {
  const postosArq = JSON.parse(fs.readFileSync(path.join(pasta, 'postos.json'), 'utf8'));
  const cacheArq = path.join(pasta, 'cache.json');
  const cache = fs.existsSync(cacheArq) ? JSON.parse(fs.readFileSync(cacheArq, 'utf8')) : {};
  const salvar = () => fs.writeFileSync(cacheArq, JSON.stringify(cache, null, 1));
  const s = criarServicos(fetchFn, chave, cache, salvar);

  const postos = [];
  for (const p of postosArq) {
    const g = p.coord ? { coord: p.coord } : await s.geocodificar(p.endereco);
    if (!g.coord) throw new Error('Nao achei coordenada do posto ' + p.nome + '. Confira o endereco em postos.json (ou informe "coord": [lon, lat]).');
    postos.push({ nome: p.nome, coord: g.coord });
  }

  const linhas = fs.readFileSync(path.join(pasta, 'ceps.txt'), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const saida = [['cep', 'cidade', 'bairro', 'A_posto', 'A_min', 'A_km', 'A_faixa', 'B_posto', 'B_min', 'B_km', 'B_faixa', 'alerta', 'sua_opiniao'].join(';')];
  for (const linha of linhas) {
    const [cepBruto, ...resto] = linha.split(';');
    const cep = limparCep(cepBruto), opiniao = resto.join(';').trim();
    const v = await s.viacep(cep);
    if (v.erro) { saida.push([cep, 'CEP nao encontrado', '', '', '', '', '', '', '', '', '', 'viaCEP nao achou', opiniao].join(';')); continue; }
    const texto = [v.logradouro, v.bairro, v.localidade, v.uf, 'Brasil'].filter(Boolean).join(', ');
    const gA = await s.geocodificar(texto);
    const gB = await s.awesome(cep);
    const A = await melhorPosto(s, gA.coord, postos), B = await melhorPosto(s, gB.coord, postos);
    const alertas = [];
    if (!gA.coord) alertas.push('A sem coordenada'); if (!gB.coord) alertas.push('B sem coordenada');
    if (A.min != null && B.min != null) {
      if (A.posto !== B.posto) alertas.push('postos diferentes');
      if (Math.abs(A.min - B.min) > CONFIG.divergenciaMin) alertas.push('tempos divergem');
    }
    saida.push([cep, v.localidade, v.bairro, A.posto, A.min ?? '', A.km ?? '', faixa(A.min), B.posto, B.min ?? '', B.km ?? '', faixa(B.min), alertas.join(' / '), opiniao].join(';'));
    console.log(cep, '|', v.localidade, '-', v.bairro, '| A:', A.posto, A.min ?? A.nota, 'min | B:', B.posto, B.min ?? B.nota, 'min', alertas.length ? '| ! ' + alertas.join(', ') : '');
    await dormir(pausa);
  }
  fs.writeFileSync(path.join(pasta, 'resultado.csv'), '﻿' + saida.join('\n'));
  console.log('\nPronto: resultado.csv (abra no Excel/Google Sheets; separador ponto e virgula).');
  return saida;
}

module.exports = { principal, CONFIG };

if (require.main === module) {
  const chave = process.env.ORS_API_KEY;
  if (!chave) { console.error('Defina a chave do OpenRouteService na variavel ORS_API_KEY (ela nao fica gravada em nenhum arquivo).'); process.exit(1); }
  principal({ fetchFn: fetch, chave, pasta: __dirname, pausa: CONFIG.pausaMs }).catch(e => { console.error('ERRO:', e.message); process.exit(1); });
}
