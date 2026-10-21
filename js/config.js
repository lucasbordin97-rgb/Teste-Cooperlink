// Constantes do site e estado do agendamento. O SCRIPT_URL aponta para o Apps Script.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyKpqBTom5p0x7dgMXSSZ7a2c8298HPZKfAeVsa414hcR-DMLhn5yTY_xuAfhp0ts7d/exec";
const TELEFONE_CENTRAL = "(19) 2042-3966";
const DIAS_MAXIMOS_AGENDAMENTO = 60;

const POSTO_HENRICAR = {
  nome: "Henricar - Av. Benjamin Constant, 550, Campinas/SP (CEP 13010-140)",
  cidade: "Campinas - SP",
  cep: "13010-140"
};
// Postos da Grande SP. O id é o mesmo usado em dados/cobertura (tools/gerar_cobertura.py).
// O texto de "nome" é o que vai para a planilha: precisa estar igual no Apps Script.
const POSTOS_SP = {
  h7: { nome: "H7 - R. Pedro Soares de Andrade, 579 - Vila Rosária, São Paulo/SP (CEP 08021-040)", curto: "H7", local: "São Miguel Paulista", endereco: "R. Pedro Soares de Andrade, 579 • Vila Rosária, São Paulo/SP" },
  ca: { nome: "Posto Carapicuíba - Rua Mota Valentim, 106 - Vila Creti, Carapicuíba/SP (CEP 06317-280)", curto: "Posto Carapicuíba", local: "Carapicuíba", endereco: "Rua Mota Valentim, 106 • Vila Creti, Carapicuíba/SP" },
  la: { nome: "Posto Lapa - Rua Afonso Sardinha, 418 - Lapa, São Paulo/SP (CEP 05076-000)", curto: "Posto Lapa", local: "Lapa", endereco: "Rua Afonso Sardinha, 418 • Lapa, São Paulo/SP" },
  ar: { nome: "Posto Arujá - Av. Amazonas, 66 - Barbosas, Arujá/SP (CEP 07402-085)", curto: "Posto Arujá", local: "Arujá", endereco: "Av. Amazonas, 66 • Barbosas, Arujá/SP" },
  st: { nome: "Stop System - Rua Rio de Janeiro, 346 - Jardim Oratório, Mauá/SP (CEP 09381-050)", curto: "Stop System", local: "Mauá", endereco: "Rua Rio de Janeiro, 346 • Jardim Oratório, Mauá/SP" },
  fl: { nome: "FL Sound - Estr. de Mogi das Cruzes, 1012 - Vila Rio Branco, São Paulo/SP (CEP 03890-100)", curto: "FL Sound", local: "Penha", endereco: "Estr. de Mogi das Cruzes, 1012 • Vila Rio Branco, São Paulo/SP" },
  gc: { nome: "Garagem Custom - Rua Joaquim José Maia, 157, São Bernardo do Campo/SP (CEP 09790-450)", curto: "Garagem Custom", local: "São Bernardo do Campo", endereco: "Rua Joaquim José Maia, 157 • São Bernardo do Campo/SP" },
  ho: { nome: "Hotpoint Som e Acessórios - Rua Doutor Felice Buscaglia, 441 - Cidade São Mateus, São Paulo/SP (CEP 03963-080)", curto: "Hotpoint Som e Acessórios", local: "São Mateus", endereco: "Rua Doutor Felice Buscaglia, 441 • Cidade São Mateus, São Paulo/SP" },
  ex: { nome: "Extreme Som e Acessórios - Av. Ver. João Batista Fitipaldi, 1421 - Vila Maluf, Suzano/SP (CEP 08685-190)", curto: "Extreme Som e Acessórios", local: "Suzano", endereco: "Av. Ver. João Batista Fitipaldi, 1421 • Vila Maluf, Suzano/SP" },
  jp: { nome: "JP Som e Acessórios Automotivos - Rua Estevão de Fabri, 02 - Parque Atlântico, São Paulo/SP (CEP 04803-000)", curto: "JP Som e Acessórios Automotivos", local: "Grajaú", endereco: "Rua Estevão de Fabri, 02 • Parque Atlântico, São Paulo/SP" }
};
// Postos fora da Grande SP. Atendem por CIDADE (não precisam da tabela de tempo de carro).
// Para cadastrar um posto: veja "Como cadastrar um posto novo" no README (ou rode tools/novo_posto.py),
// copie o modelo abaixo, troque os dados e cadastre o MESMO texto de "nome" no Apps Script.
// Modelo (tire as barras para usar). Em "cidades", escreva sem acento e em minúsculas, como no ViaCEP:
//   cu: { nome: "Nome do Posto - Rua X, 100 - Bairro, Curitiba/PR (CEP 80000-000)", curto: "Nome do Posto",
//         local: "Curitiba", endereco: "Rua X, 100 • Bairro, Curitiba/PR", uf: "PR", cidades: ["curitiba", "sao jose dos pinhais"] },
const POSTOS_OUTROS = {
  lsm: { nome: "Laser Som - R. Onze de Agosto, 1279, Jardim Lucila, Tatuí/SP (CEP 18275-000)", curto: "Laser Som",
        local: "Tatuí", endereco: "R. Onze de Agosto, 1279 • Jardim Lucila, Tatuí/SP", uf: "SP", cidades: ["tatui"] },
  amc: { nome: "Automec - R. 28, 1580, Centro, Barretos/SP (CEP 14780-110)", curto: "Automec",
        local: "Barretos", endereco: "R. 28, 1580 • Centro, Barretos/SP", uf: "SP", cidades: ["barretos"] },
  cea: { nome: "Central Elétrica Automotiva Ltda - Travessa Gino Mazola, 95/105, Jd São Cristóvão, Bragança Paulista/SP (CEP 12906-010)", curto: "Central Elétrica Automotiva Ltda",
        local: "Bragança Paulista", endereco: "Travessa Gino Mazola, 95/105 • Jd São Cristóvão, Bragança Paulista/SP", uf: "SP", cidades: ["braganca paulista"] },
  ars: { nome: "Art Som Loja de Som e Acessórios - R. Chile, 51, Vila Bela, Franco da Rocha/SP (CEP 07847-120)", curto: "Art Som Loja de Som e Acessórios",
        local: "Franco da Rocha", endereco: "R. Chile, 51 • Vila Bela, Franco da Rocha/SP", uf: "SP", cidades: ["franco da rocha"] },
  pfs: { nome: "Perfeison o Som do Seu Carro - Av. Dr Cavalcanti, 179, Vila Arens, Jundiaí/SP (CEP 13201-003)", curto: "Perfeison o Som do Seu Carro",
        local: "Jundiaí", endereco: "Av. Dr Cavalcanti, 179 • Vila Arens, Jundiaí/SP", uf: "SP", cidades: ["jundiai"] },
  dez: { nome: "Auto Elétrica Dezotti Ltda - Av. Pedro Botesi, 1362, Jardim Scomparim, Mogi Mirim/SP (CEP 13806-635)", curto: "Auto Elétrica Dezotti Ltda",
        local: "Mogi Mirim", endereco: "Av. Pedro Botesi, 1362 • Jardim Scomparim, Mogi Mirim/SP", uf: "SP", cidades: ["mogi mirim"] },
  cal: { nome: "Cleber Potapczuk - Av. Olindo Tamagnini, 545, Pedreira, Mongaguá/SP (CEP 11730-000)", curto: "Cleber Potapczuk",
        local: "Mongaguá", endereco: "Av. Olindo Tamagnini, 545 • Pedreira, Mongaguá/SP", uf: "SP", cidades: ["mongagua"] },
  sir: { nome: "Siri Som e Alarme - Av. Padre Anchieta, 5200, Jardim Imperador, Peruíbe/SP (CEP 11750-000)", curto: "Siri Som e Alarme",
        local: "Peruíbe", endereco: "Av. Padre Anchieta, 5200 • Jardim Imperador, Peruíbe/SP", uf: "SP", cidades: ["peruibe"] },
  jmz: { nome: "Auto Elétrica José Mateuzzo - R. Ingá, 530, Paulicéia, Piracicaba/SP (CEP 13401-543)", curto: "Auto Elétrica José Mateuzzo",
        local: "Piracicaba", endereco: "R. Ingá, 530 • Paulicéia, Piracicaba/SP", uf: "SP", cidades: ["piracicaba"] },
  cts: { nome: "Center Som e Acessórios - Av. Cel. Quito Junqueira, 380, Campos Elísios, Ribeirão Preto/SP (CEP 14085-610)", curto: "Center Som e Acessórios",
        local: "Ribeirão Preto", endereco: "Av. Cel. Quito Junqueira, 380 • Campos Elísios, Ribeirão Preto/SP", uf: "SP", cidades: ["ribeirao preto"] },
  sps: { nome: "Super Som - R. Prudente de Moraes, 1025, Parque Industrial, São José do Rio Preto/SP (CEP 15025-045)", curto: "Super Som",
        local: "São José do Rio Preto", endereco: "R. Prudente de Moraes, 1025 • Parque Industrial, São José do Rio Preto/SP", uf: "SP", cidades: ["sao jose do rio preto"] },
  ogo: { nome: "Oficina Mecânica e Elétrica Gonçalves - Rua São Paulo, 606, Taboão, São Roque/SP (CEP 18130-000)", curto: "Oficina Mecânica e Elétrica Gonçalves",
        local: "São Roque", endereco: "Rua São Paulo, 606 • Taboão, São Roque/SP", uf: "SP", cidades: ["sao roque"] },
  exc: { nome: "Extreme São Carlos - R. Ananias Evangelista de Toledo, 878, Vila Prado, São Carlos/SP (CEP 13574-280)", curto: "Extreme São Carlos",
        local: "São Carlos", endereco: "R. Ananias Evangelista de Toledo, 878 • Vila Prado, São Carlos/SP", uf: "SP", cidades: ["sao carlos"] },
  mgc: { nome: "Mega Center Som e Acessórios - R. Bacabal, 1068, Parque Industrial, São José dos Campos/SP (CEP 12235-680)", curto: "Mega Center Som e Acessórios",
        local: "São José dos Campos", endereco: "R. Bacabal, 1068 • Parque Industrial, São José dos Campos/SP", uf: "SP", cidades: ["sao jose dos campos"] },
  jrf: { nome: "JR Filme e Acessórios - Av. São Paulo, 951, Além Ponte, Sorocaba/SP (CEP 18013-002)", curto: "JR Filme e Acessórios",
        local: "Sorocaba", endereco: "Av. São Paulo, 951 • Além Ponte, Sorocaba/SP", uf: "SP", cidades: ["sorocaba"] },
  asc: { nome: "Auto Som Curitiba - Av. Nossa Senhora de Lourdes, 975, Jardim das Américas, Curitiba/PR (CEP 81530-020)", curto: "Auto Som Curitiba",
        local: "Curitiba", endereco: "Av. Nossa Senhora de Lourdes, 975 • Jardim das Américas, Curitiba/PR", uf: "PR", cidades: ["curitiba"] },
  spc: { nome: "Sport Car - Av. Professor Walter Thaumaturgo, 417, Jardim das Nações, Taubaté/SP (CEP 12030-040)", curto: "Sport Car",
        local: "Taubaté", endereco: "Av. Professor Walter Thaumaturgo, 417 • Jardim das Nações, Taubaté/SP", uf: "SP", cidades: ["taubate"] },
  pon: { nome: "Pontelli Acessórios - Av. Francisco Vaz Filho, 2192, Jardim Tabapuã (Vila Xavier), Araraquara/SP (CEP 14811-218)", curto: "Pontelli Acessórios",
        local: "Araraquara", endereco: "Av. Francisco Vaz Filho, 2192 • Jardim Tabapuã (Vila Xavier), Araraquara/SP", uf: "SP", cidades: ["araraquara"] },
  pws: { nome: "Power Som - Av. Nossa Senhora de Fátima, 875, Jardim América, Bauru/SP (CEP 17017-337)", curto: "Power Som",
        local: "Bauru", endereco: "Av. Nossa Senhora de Fátima, 875 • Jardim América, Bauru/SP", uf: "SP", cidades: ["bauru"] },
  jng: { nome: "Jango Auto Som e Películas - R. Leite Ribeiro, 290, Anita Garibaldi, Joinville/SC (CEP 89202-090)", curto: "Jango Auto Som e Películas",
        local: "Joinville", endereco: "R. Leite Ribeiro, 290 • Anita Garibaldi, Joinville/SC", uf: "SC", cidades: ["joinville"] },
  ods: { nome: "Oficina do Som - R. Dona Maria Alves, 995, Centro, Ubatuba/SP (CEP 11680-000)", curto: "Oficina do Som",
        local: "Ubatuba", endereco: "R. Dona Maria Alves, 995 • Centro, Ubatuba/SP", uf: "SP", cidades: ["ubatuba"] },
  cvl: { nome: "Carvioli Shopping Ltda - Av. Rio Branco, 1535, Indaiá, Caraguatatuba/SP (CEP 11665-600)", curto: "Carvioli Shopping Ltda",
        local: "Caraguatatuba", endereco: "Av. Rio Branco, 1535 • Indaiá, Caraguatatuba/SP", uf: "SP", cidades: ["caraguatatuba"] },
  nil: { nome: "Nilsom Sound System - Av. 19 de Maio, 761, Loja 02, Albatroz, Bertioga/SP (CEP 11250-734)", curto: "Nilsom Sound System",
        local: "Bertioga", endereco: "Av. 19 de Maio, 761, Loja 02 • Albatroz, Bertioga/SP", uf: "SP", cidades: ["bertioga"] },
  vkr: { nome: "Vista KR Acessórios - Av. Brasília, 1473, Villa Zanetti, São João da Boa Vista/SP (CEP 13870-590)", curto: "Vista KR Acessórios",
        local: "São João da Boa Vista", endereco: "Av. Brasília, 1473 • Villa Zanetti, São João da Boa Vista/SP", uf: "SP", cidades: ["sao joao da boa vista"] },
  lin: { nome: "Lindinho Som - Rua Inglaterra, 15, Vila Rica, Lorena/SP (CEP 12608-786)", curto: "Lindinho Som",
        local: "Lorena", endereco: "Rua Inglaterra, 15 • Vila Rica, Lorena/SP", uf: "SP", cidades: ["lorena"] },
  ads: { nome: "Loja Adautosom - R. Cel. Pedro Dias Batista, 1680, Centro, Itapetininga/SP (CEP 18201-810)", curto: "Loja Adautosom",
        local: "Itapetininga", endereco: "R. Cel. Pedro Dias Batista, 1680 • Centro, Itapetininga/SP", uf: "SP", cidades: ["itapetininga"] },
  sjr: { nome: "San José Rastreador - Av. Manoel Goulart, 399, Vila Nova, Presidente Prudente/SP (CEP 19010-270)", curto: "San José Rastreador",
        local: "Presidente Prudente", endereco: "Av. Manoel Goulart, 399 • Vila Nova, Presidente Prudente/SP", uf: "SP", cidades: ["presidente prudente"] },
  ang: { nome: "Angelo Somcar - Rua Guamirin, 921, Tabuleiro, Camboriú/SC (CEP 88348-107)", curto: "Angelo Somcar",
        local: "Camboriú", endereco: "Rua Guamirin, 921 • Tabuleiro, Camboriú/SC", uf: "SC", cidades: ["camboriu"] },
  dst: { nome: "Destak Auto Car - R. Walter Antônio Muzel Gonçalves, 82, Jardim Morada do Sol, Itapeva/SP (CEP 18408-651)", curto: "Destak Auto Car",
        local: "Itapeva", endereco: "R. Walter Antônio Muzel Gonçalves, 82 • Jardim Morada do Sol, Itapeva/SP", uf: "SP", cidades: ["itapeva"] },
  smf: { nome: "Summer Films - Rua Raul Soares, 91, Fabrício, Uberaba/MG (CEP 38065-410)", curto: "Summer Films",
        local: "Uberaba", endereco: "Rua Raul Soares, 91 • Fabrício, Uberaba/MG", uf: "MG", cidades: ["uberaba"] },
  jce: { nome: "José Carlos - Av. General Melo, 853, Dom Aquino, Cuiabá/MT (CEP 78015-300)", curto: "José Carlos",
        local: "Cuiabá", endereco: "Av. General Melo, 853 • Dom Aquino, Cuiabá/MT", uf: "MT", cidades: ["cuiaba"] },
  uds: { nome: "Universo do Som - Av. Emílio Carlos, 301, Vila Maia (Centro), Guarujá/SP (CEP 11410-140)", curto: "Universo do Som",
        local: "Guarujá", endereco: "Av. Emílio Carlos, 301 • Vila Maia (Centro), Guarujá/SP", uf: "SP", cidades: ["guaruja"] },
  gcr: { nome: "GCAR Reparos Automotivos - Estrada José Pires de Moraes, 103, Filipinho, Embu-Guaçu/SP (CEP 06911-605)", curto: "GCAR Reparos Automotivos",
        local: "Embu-Guaçu", endereco: "Estrada José Pires de Moraes, 103 • Filipinho, Embu-Guaçu/SP", uf: "SP", cidades: ["embu-guacu"] },
  ros: { nome: "Auto Elétrica Acessórios Roseira - Rua Olavo Bilac, 502 (fundo), Centro, Tapejara/PR (CEP 87430-000)", curto: "Auto Elétrica Acessórios Roseira",
        local: "Tapejara", endereco: "Rua Olavo Bilac, 502 (fundo) • Centro, Tapejara/PR", uf: "PR", cidades: ["tapejara"] },
  rtk: { nome: "Retocksom - Rua Maria Teles, 1, Cambolo, Porto Seguro/BA (CEP 45810-000)", curto: "Retocksom",
        local: "Porto Seguro", endereco: "Rua Maria Teles, 1 • Cambolo, Porto Seguro/BA", uf: "BA", cidades: ["porto seguro"] },
  dro: { nome: "Auto Elétrica Drobeniche - Av. Doutor Hermínio Ometto, 1240, Jardim São José, Leme/SP (CEP 13610-119)", curto: "Auto Elétrica Drobeniche",
        local: "Leme", endereco: "Av. Doutor Hermínio Ometto, 1240 • Jardim São José, Leme/SP", uf: "SP", cidades: ["leme"] },
  mas: { nome: "Master Som e Acessórios - R. Anhumas, 271, Vila Prudenciana, Assis/SP (CEP 19803-210)", curto: "Master Som e Acessórios",
        local: "Assis", endereco: "R. Anhumas, 271 • Vila Prudenciana, Assis/SP", uf: "SP", cidades: ["assis"] },
};
// Todos os postos com agenda própria (Grande SP + outros); a Henricar tem regra própria.
const POSTOS = Object.assign({}, POSTOS_SP, POSTOS_OUTROS);

// Cidades do entorno de Campinas atendidas pelo técnico parceiro Claudemir (sem posto próprio). Escreva sem acento e em
// minúsculas, como o ViaCEP devolve; vale só para SP. Campinas e Hortolândia ficam de fora: lá vale a Henricar.
const CIDADES_TECNICO_CAMPINAS = ["jaguariuna", "cosmopolis", "limeira", "atibaia", "sumare", "paulinia", "americana",
  "artur nogueira", "arthur nogueira", "monte mor", "indaiatuba", "nova odessa", "santa barbara d'oeste", "santa barbara doeste",
  "holambra", "valinhos", "vinhedo", "itatiba", "louveira", "amparo", "pedreira"];

// Chave de segurança: com false o site usa só a regra antiga (Campinas/Hortolândia = Henricar, o resto = técnico).
const USAR_TABELA_COBERTURA = true;
// Até quantos minutos de carro um posto ainda atende; acima disso vai para técnico externo.
const LIMITE_MINUTOS_POSTO = 30;

// Postos com agenda própria (data e horário). Novos postos entram aqui e no Apps Script.
const POSTOS_COM_AGENDA = [POSTO_HENRICAR.nome].concat(Object.keys(POSTOS).map(function(id) { return POSTOS[id].nome; }));
const horariosManha = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
const horariosTarde = ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:20"];
const todosHorarios = horariosManha.concat(horariosTarde);

let estadoAgendamento = {
  servico: "",
  posto: null,
  cep: "",
  cepFormatado: "",
  enderecoFormatado: "",
  viaCep: null,   // rua, bairro e cidade/UF do CEP (para pré-preencher o endereço do técnico)
  isTecnicoExterno: false,
  motivoSemPosto: "",
  postosDisponiveis: [],   // postos mostrados ao associado (só vai na planilha se ele disser que não consegue ir)
  data: "",
  horario: ""
};

let slotsOcupadosNaNuvem = [];
let ultimaSincronizacao = 0;
let slideAtual = 0;
let intervaloCarrossel = null;
