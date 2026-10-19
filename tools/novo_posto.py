#!/usr/bin/env python3
"""Gera os trechos para cadastrar um posto novo (fora da Grande SP), sem editar nada sozinho.

Uso:
  python3 tools/novo_posto.py --id cu --nome "Nome do Posto" --rua "Rua X, 100" --bairro "Bairro" \
      --cidade Curitiba --uf PR --cep 80000-000 --cidades "curitiba, sao jose dos pinhais" \
      [--feriados "03-29=Aniversário de Curitiba"]

Depois cole cada trecho no lugar indicado (o README explica). O texto de "nome" tem que ser IGUAL no site e no Apps Script.
"""
import argparse, re, sys, unicodedata

def sem_acento(t):
    return unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode().lower().strip()

ap = argparse.ArgumentParser()
for a in ["id", "nome", "rua", "bairro", "cidade", "uf", "cep"]:
    ap.add_argument("--" + a, required=True)
ap.add_argument("--cidades", help='cidades atendidas, separadas por vírgula (padrão: só a cidade do posto)')
ap.add_argument("--feriados", help='feriados da cidade: "MM-DD=Nome;MM-DD=Nome"')
a = ap.parse_args()

if not re.fullmatch(r"[a-z]{2,4}", a.id): sys.exit("--id: use 2 a 4 letras minúsculas, sem repetir as dos outros postos (h7, ca, la, ar, st, fl, gc, ho, ex, jp, henricar).")
if not re.fullmatch(r"\d{5}-\d{3}", a.cep): sys.exit("--cep: use o formato 00000-000")
if not re.fullmatch(r"[A-Za-z]{2}", a.uf): sys.exit("--uf: use a sigla com 2 letras")
uf = a.uf.upper()
nome = f"{a.nome} - {a.rua}, {a.bairro}, {a.cidade}/{uf} (CEP {a.cep})"
endereco = f"{a.rua} • {a.bairro}, {a.cidade}/{uf}"
cidades = [sem_acento(c) for c in (a.cidades or a.cidade).split(",") if c.strip()]
cid_js = ", ".join('"' + c + '"' for c in cidades)

print("=== 1) js/config.js: dentro de POSTOS_OUTROS ===")
print(f'  {a.id}: {{ nome: "{nome}", curto: "{a.nome}",\n        local: "{a.cidade}", endereco: "{endereco}", uf: "{uf}", cidades: [{cid_js}] }},\n')
print("=== 2) Apps Script: no fim da lista POSTOS_SP e da lista IDS_POSTOS_SP (mesma ordem do site) ===")
print(f'  POSTOS_SP:      "{nome}"')
print(f"  IDS_POSTOS_SP:  '{a.id}'\n")
if a.feriados:
    itens = [x.split("=", 1) for x in a.feriados.split(";") if "=" in x]
    print("=== 3) Feriados da cidade: js/feriados.js (FERIADOS_MUNICIPAIS) e Apps Script (FERIADOS_MUNICIPAIS) ===")
    print(f"  {a.id}: {{ " + ", ".join(f'"{d.strip()}": "{n.strip()}"' for d, n in itens) + " },\n")
print("=== Depois ===")
print("  - Rode: node tests/postos.test.js index.html caminho/do/apps-script.gs   (confere se site e Apps Script têm o mesmo texto)")
print("  - Apps Script: salve e faça Implantar > Nova versão.")
