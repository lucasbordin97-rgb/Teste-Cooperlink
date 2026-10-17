#!/usr/bin/env python3
"""Gera dados/cobertura/NNN.json: para cada CEP da Grande SP, os 3 postos mais próximos de carro.

Uso: python3 tools/gerar_cobertura.py CEPS_SP.csv POSTOS.csv MUNICIPIOS_SP.json [OSRM_URL]
- CEPS_SP.csv: um ponto por CEP, agregado do CNEFE 2022 do IBGE (colunas CEP, municipio, lat, lng).
- POSTOS.csv: colunas id, cep (o ponto do posto sai da mesma base de CEP).
- OSRM_URL: servidor OSRM local com o mapa do Sudeste (padrão http://localhost:5000). Tempo sem trânsito.
Cada arquivo NNN.json (3 primeiros dígitos do CEP) tem {"<5 últimos dígitos>": "<posto>:<min>,<posto>:<min>,..."}.
Os minutos são arredondados PARA CIMA: "min <= 30" na tabela equivale a "tempo real <= 30 min".
"""
import csv, json, math, os, sys, urllib.request
ceps_csv, postos_csv, mun_json = sys.argv[1:4]
OSRM = sys.argv[4] if len(sys.argv) > 4 else "http://localhost:5000"
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dados", "cobertura")
GRANDE_SP = {"Arujá", "Barueri", "Biritiba-Mirim", "Caieiras", "Cajamar", "Carapicuíba", "Cotia", "Diadema", "Embu das Artes",
    "Embu-Guaçu", "Ferraz de Vasconcelos", "Francisco Morato", "Franco da Rocha", "Guararema", "Guarulhos", "Itapecerica da Serra",
    "Itapevi", "Itaquaquecetuba", "Jandira", "Juquitiba", "Mairiporã", "Mauá", "Mogi das Cruzes", "Osasco", "Pirapora do Bom Jesus",
    "Poá", "Ribeirão Pires", "Rio Grande da Serra", "Salesópolis", "Santa Isabel", "Santana de Parnaíba", "Santo André",
    "São Bernardo do Campo", "São Caetano do Sul", "São Lourenço da Serra", "São Paulo", "Suzano", "Taboão da Serra",
    "Vargem Grande Paulista"}
cidades = {str(m["id"]): m["nome"] for m in json.load(open(mun_json))}
linhas = {r["CEP"]: r for r in csv.DictReader(open(ceps_csv))}
postos = list(csv.DictReader(open(postos_csv)))
destinos = [f'{linhas[p["cep"]]["lng"]},{linhas[p["cep"]]["lat"]}' for p in postos]
alvo = [r for r in linhas.values() if cidades.get(r["municipio"]) in GRANDE_SP]
print(len(alvo), "CEPs na Grande SP;", len(postos), "postos")
shards = {}
for i in range(0, len(alvo), 100):
    lote = alvo[i:i + 100]
    coords = destinos + [f'{r["lng"]},{r["lat"]}' for r in lote]
    url = (f"{OSRM}/table/v1/driving/" + ";".join(coords) + "?sources=" + ";".join(str(k) for k in range(len(destinos), len(coords)))
           + "&destinations=" + ";".join(str(k) for k in range(len(destinos))) + "&annotations=duration")
    dur = json.load(urllib.request.urlopen(url, timeout=300))["durations"]
    for r, linha in zip(lote, dur):
        ordem = sorted((d, p["id"]) for d, p in zip(linha, postos) if d is not None)[:3]
        if ordem:
            shards.setdefault(r["CEP"][:3], {})[r["CEP"][3:]] = ",".join(f"{pid}:{math.ceil(d / 60)}" for d, pid in ordem)
    if (i // 100) % 100 == 0: print(i, "de", len(alvo), flush=True)
os.makedirs(SAIDA, exist_ok=True)
for f in os.listdir(SAIDA):
    if f.endswith(".json"): os.remove(os.path.join(SAIDA, f))
for pref, d in shards.items():
    json.dump(d, open(os.path.join(SAIDA, pref + ".json"), "w"), separators=(",", ":"))
print("arquivos:", len(shards), "| CEPs gravados:", sum(len(d) for d in shards.values()))
