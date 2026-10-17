# Teste isolado: tempo de carro até os postos (São Paulo)

Ferramenta de teste. **Não faz parte do site** e não é publicada na Vercel (fica só nesta branch).
Compara dois jeitos de achar a coordenada do associado e mostra o posto mais próximo por tempo de carro:

- **A:** viaCEP (endereço) -> OpenRouteService (coordenada) -> OpenRouteService (tempo)
- **B:** AwesomeAPI CEP (coordenada direto do CEP) -> OpenRouteService (tempo)

## Como rodar (no seu computador, Node 18 ou mais novo)
1. Crie uma conta gratuita em openrouteservice.org e gere uma chave de API. **Não cole a chave no chat nem em arquivos.**
2. Copie `postos.exemplo.json` para `postos.json` e troque os endereços dos 6 postos (rua, número, bairro, cidade).
3. Copie `ceps.exemplo.txt` para `ceps.txt` e coloque um CEP por linha. Depois do `;` escreva a sua opinião (ex.: `07400-000;iria para Arujá`). **Só CEP: sem nome, telefone ou placa.**
4. Rode, passando a chave só nesse comando:
   - Mac/Linux: `ORS_API_KEY=suachave node teste.js`
   - Windows (PowerShell): `$env:ORS_API_KEY="suachave"; node teste.js`
5. Abra o `resultado.csv` (separador ponto e vírgula) e compare as colunas A e B com a sua opinião.

`postos.json`, `ceps.txt`, `cache.json` e `resultado.csv` ficam fora do Git de propósito (o repositório é público).

## Como ler o resultado
- `A_min` / `B_min`: minutos de carro até o posto mais próximo, sem trânsito ao vivo (o real em horário de pico costuma ser maior).
- Faixas: perto até 25 min, média distância até 40 min, acima disso técnico externo. Os números ficam em `CONFIG` no `teste.js`.
- `alerta`: aparece quando os métodos divergem (postos diferentes ou mais de 5 min de diferença) ou falta coordenada.

`node verificar-offline.js` confere a lógica com respostas simuladas, sem internet. Ele não mede a precisão real das APIs.
