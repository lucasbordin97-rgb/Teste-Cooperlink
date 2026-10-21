// Cobertura por tempo de carro: consulta a tabela dados/cobertura (CEP -> postos mais próximos).
// Só é usada com USAR_TABELA_COBERTURA ligado. Qualquer falha devolve null e o site volta à regra antiga.
const CIDADES_GRANDE_SP = [
  "aruja", "barueri", "biritiba-mirim", "caieiras", "cajamar", "carapicuiba", "cotia", "diadema", "embu das artes",
  "embu-guacu", "ferraz de vasconcelos", "francisco morato", "franco da rocha", "guararema", "guarulhos",
  "itapecerica da serra", "itapevi", "itaquaquecetuba", "jandira", "juquitiba", "mairipora", "maua", "mogi das cruzes",
  "osasco", "pirapora do bom jesus", "poa", "ribeirao pires", "rio grande da serra", "salesopolis", "santa isabel",
  "santana de parnaiba", "santo andre", "sao bernardo do campo", "sao caetano do sul", "sao lourenco da serra",
  "sao paulo", "suzano", "taboao da serra", "vargem grande paulista"
];

const arquivosCobertura = {};

// Só vale em SP: Santo André, por exemplo, também existe na Paraíba.
function cidadeEhGrandeSP(cidade, uf) {
  return normalizarTexto(uf) === "sp" && CIDADES_GRANDE_SP.indexOf(normalizarTexto(cidade)) !== -1;
}

// Devolve { noMapa, postos: [{ id, minutos }] } ou null se a tabela não puder ser lida.
// postos vem do mais próximo para o mais distante, só com os que estão dentro do limite de minutos.
async function consultarCobertura(cep8) {
  const prefixo = cep8.slice(0, 3);
  if (!(prefixo in arquivosCobertura)) {
    const res = await fetchComTimeout("dados/cobertura/" + prefixo + ".json", {}, 7000);
    if (res.status === 404) {
      arquivosCobertura[prefixo] = {};
    } else if (!res.ok) {
      return null;
    } else {
      arquivosCobertura[prefixo] = await res.json();
    }
  }
  const linha = arquivosCobertura[prefixo][cep8.slice(3)];
  if (!linha) return { noMapa: false, postos: [] };

  const postos = linha.split(",").map(function(par) {
    const partes = par.split(":");
    return { id: partes[0], minutos: Number(partes[1]) };
  }).filter(function(p) {
    return POSTOS_SP[p.id] && p.minutos <= LIMITE_MINUTOS_POSTO;
  });
  return { noMapa: true, postos: postos };
}

async function consultarCoberturaSegura(cep8) {
  try {
    return await consultarCobertura(cep8);
  } catch (e) {
    return null;
  }
}
