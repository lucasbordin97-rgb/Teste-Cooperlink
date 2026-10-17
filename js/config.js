// Constantes do site e estado do agendamento. O SCRIPT_URL aponta para o Apps Script.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyKpqBTom5p0x7dgMXSSZ7a2c8298HPZKfAeVsa414hcR-DMLhn5yTY_xuAfhp0ts7d/exec";
const TELEFONE_CENTRAL = "(19) 2042-3966";
const DIAS_MAXIMOS_AGENDAMENTO = 60;

const POSTO_HENRICAR = {
  nome: "Henricar - Av. Benjamin Constant, 550, Campinas/SP (CEP 13010-140)",
  cidade: "Campinas - SP",
  cep: "13010-140"
};
// Postos com agenda própria (data e horário). Novos postos entram aqui e no Apps Script.
const POSTOS_COM_AGENDA = [POSTO_HENRICAR.nome];
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
