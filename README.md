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
  - `cobertura.js`: consulta a tabela de cobertura por tempo de carro (só com a chave ligada)
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

## Cobertura por tempo de carro (desligada por padrão)
Para a Grande SP, o site pode escolher o posto pelo **tempo de carro** até ele (limite de 30 min; acima disso vai para técnico externo). Quem mora fora da cobertura deixa o contato e a autorização para ser avisado quando o serviço chegar à região.

- A chave é `USAR_TABELA_COBERTURA` em `js/config.js`. Com `false` o site se comporta como antes. Se a tabela não carregar, o site também volta à regra antiga.
- `dados/cobertura/NNN.json`: para cada CEP (3 primeiros dígitos no nome do arquivo), os 3 postos mais próximos e os minutos de carro. Tempo **sem trânsito**, arredondado para cima.
- `tools/gerar_cobertura.py` gera essa tabela a partir do CNEFE 2022 do IBGE (um ponto por CEP) e de um servidor OSRM local. Rode de novo se mudar a lista de postos (`POSTOS_SP` em `config.js`) ou o limite.
- Campinas e Hortolândia seguem na Henricar pela regra antiga e não passam pela tabela.
- O pedido de contato usa a ação `interesse` do Apps Script (grava na aba "Interesse"). O código da ação não fica aqui.
- Cada posto novo precisa do mesmo nome em `POSTOS_SP` e na lista de postos aceitos do Apps Script.

## Testes
`node tests/site.test.js index.html` roda 30 verificações do site num navegador de teste, sem internet: fluxo de agendamento, mensagens de erro, técnico externo, janela de 60 dias, LGPD e violações da política de segurança (CSP).
`node tests/cobertura.test.js index.html` roda 17 verificações da cobertura por tempo de carro (posto perto, técnico externo, fora da cobertura com consentimento, tabela fora do ar e chave desligada).
Precisa do pacote `playwright` e do Chromium (use `CHROMIUM_PATH` se o caminho for outro).
Os testes do Apps Script não estão aqui, porque o código do script não fica neste repositório público.
