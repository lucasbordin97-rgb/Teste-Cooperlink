# Origem desta skill

- Projeto: UI UX Pro Max, https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Versão: 2.15.0, commit `56ea9cf174ed86786187daa9de0e6247cb0747e4` (14/10/2026)
- Licença: MIT (arquivo `LICENSE` nesta pasta). Copyright (c) 2024 Next Level Builder.
- Copiado: `SKILL.md`, `data/`, `references/` e os scripts de `scripts/` (sem a pasta `tests/`).
- Revisado antes do uso: os scripts usam só a biblioteca padrão do Python, sem rede e sem executar comandos.
  Não foram copiadas as outras skills do projeto (design/logo, ui-styling, slides, brand), nem o instalador npx,
  nem o `stack/.claude/settings.json` (permissões amplas).

## Única alteração em relação ao original
No `SKILL.md`, o caminho `"${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py"` foi trocado por
`".claude/skills/ui-ux-pro-max/scripts/search.py"`, porque aqui a skill é usada como skill do projeto (rodar a partir
da raiz do repositório) e não como plugin.

## Atualizar
Não acompanhar o "mais recente" sem ler de novo. Para atualizar: clonar o projeto, ler as diferenças, copiar e
atualizar este arquivo com o novo commit.
