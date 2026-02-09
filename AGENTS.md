# AGENTS.md

## Objetivo
Este repositório contém um MVP web de investigação no estilo Carmen San Paulo.
A prioridade é manter o jogo **data-driven** (casos e suspeitos em JSON), sem acoplar conteúdo ao código.

## Stack e execução
- Frontend estático: `index.html` + `styles/main.css` + `js/main.js`
- Sem build tool
- Execute localmente com servidor estático:
  - `python3 -m http.server 8080`
  - abrir `http://localhost:8080`

## Estrutura principal
- `index.html`: layout e elementos de UI
- `styles/main.css`: estilo retro e responsividade
- `js/main.js`: motor de jogo (estado, ações, viagem, mandado, captura, voz)
- `data/cases-manifest.json`: catálogo de casos
- `data/cases/*.json`: definição de cada investigação
- `data/suspects/*.json`: campos de evidência e base de suspeitos por idioma
- `data/acme/`: imagens usadas pelo jogo
- `docs/json-cases.md`: referência de modelagem dos casos

## Regras de conteúdo
- Não codifique textos/pistas de caso diretamente no JS.
- Novos casos devem ser adicionados via JSON e registrados em `data/cases-manifest.json`.
- IDs devem ser estáveis:
  - `case.id`
  - `locations[].id`
  - `suspects[].id`
  - `fields[].id`
- `route[]` precisa apontar para `locations[].id` válidos.
- Cada local não final deve ter ao menos uma pista de destino para o próximo ponto da rota.

## Convenções de assets
- `ref/` é material bruto de referência e está no `.gitignore`.
- Não referencie `ref/` no código/jogo.
- Use apenas caminhos versionados em `data/acme/...`.
- Ao adicionar imagem nova:
  - prefira nome descritivo em minúsculas com `_`
  - atualize os JSONs do caso

## Voz (OpenAI)
- O jogo opera por texto por padrão.
- Voz opcional usa `POST /v1/audio/speech` no frontend.
- API key é salva em `localStorage` (protótipo, não produção).
- Observação: Whisper é transcrição STT; este projeto usa TTS para fala dos personagens.

## Compatibilidade e estilo de código
- Manter JS em ES module simples, sem dependências externas.
- Evitar recursos muito novos que quebrem validação local do ambiente.
- Preserve mensagens de erro claras no log/eventos.

## Checklist antes de commit
1. Validar sintaxe JS:
   - `node --check js/main.js`
2. Validar JSONs alterados:
   - `jq empty data/cases-manifest.json`
   - `jq empty data/cases/<arquivo>.json`
   - `jq empty data/suspects/<arquivo>.json`
3. Garantir que não há referência a `ref/`:
   - `rg -n "ref/" -S .`
4. Teste manual rápido no navegador:
   - iniciar caso
   - coletar pista
   - viajar
   - emitir mandado
   - tentar captura

## Limites atuais (importante)
- Não há backend para proteger a API key de voz.
- Não há suíte automatizada de testes (somente validações manuais + checks de sintaxe/JSON).
- O balanceamento de dificuldade depende da qualidade dos JSONs de caso.
