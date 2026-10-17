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
// Chave de segurança: com false o site usa só a regra antiga (Campinas/Hortolândia = Henricar, o resto = técnico).
const USAR_TABELA_COBERTURA = false;
// Até quantos minutos de carro um posto ainda atende; acima disso vai para técnico externo.
const LIMITE_MINUTOS_POSTO = 30;

// Postos com agenda própria (data e horário). Novos postos entram aqui e no Apps Script.
const POSTOS_COM_AGENDA = [POSTO_HENRICAR.nome].concat(Object.keys(POSTOS_SP).map(function(id) { return POSTOS_SP[id].nome; }));
const horariosManha = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
const horariosTarde = ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:20"];
const todosHorarios = horariosManha.concat(horariosTarde);

let estadoAgendamento = {
  servico: "",
  posto: null,
  cep: "",
  cepFormatado: "",
  enderecoFormatado: "",
  isTecnicoExterno: false,
  data: "",
  horario: ""
};

let slotsOcupadosNaNuvem = [];
let ultimaSincronizacao = 0;
let slideAtual = 0;
let intervaloCarrossel = null;
