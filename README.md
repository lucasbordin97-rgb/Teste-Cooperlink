# Central de Agendamento Técnico — Cooperlink Brasil

Página de agendamento de instalação, manutenção e remoção de rastreador.

- `index.html`: só a estrutura da página (textos e formulário).
- `css/estilos.css`: estilos próprios. O Tailwind vem do CDN.
- `js/`: a lógica, dividida por assunto. A ordem de carregamento no `index.html` importa.
  - `config.js`: constantes (URL do Apps Script, telefone, posto) e estado do agendamento
  - `armazenamento.js`: dados guardados no navegador (sem dados pessoais)
  - `carrossel.js`: carrossel da tela inicial
  - `agenda.js`: datas, disponibilidade de horários e fetch com timeout
  - `etapas.js`: navegação entre etapas e máscaras de CEP, telefone e placa
  - `cep.js`: busca do CEP e escolha do posto
  - `horarios.js`: escolha de data e horário
  - `envio.js`: validação e envio do agendamento
  - `principal.js`: reinício do fluxo e inicialização
  - `tailwind-config.js`: cores e fontes da marca
- `vercel.json`: cabeçalhos de segurança do site.
- Os agendamentos são gravados numa planilha do Google por um Google Apps Script
  (o código do script fica na própria planilha, em Extensões > Apps Script).
- Senhas e tokens **nunca** ficam neste repositório; ficam nas propriedades do script.
- A Vercel publica automaticamente cada alteração da branch `main`.
