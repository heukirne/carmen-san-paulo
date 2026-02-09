# Carmen San Paulo Web (MVP)

Versao web inspirada em [Where in the World is Carmen San Diego? Deluxe Edition (1992)](https://www.youtube.com/watch?v=zJ7tIdE_75Y), com foco em:

- Interface retro responsiva (desktop e celular)
- Casos configurados por JSON (locais, pistas, imagens, idioma, rota)
- Fluxo de investigacao com tempo limite, viagens, evidencias e mandado
- Dialogos em texto por padrao
- Opcao de voz com OpenAI API key (TTS)

## Rodando localmente

Use um servidor estatico (necessario para `fetch` dos JSON):

```bash
cd /home/henrique/Documentos/carmen-san-paulo
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`.

## Estrutura

- `index.html`: UI principal
- `styles/main.css`: visual retro responsivo
- `js/main.js`: motor de jogo e fluxo da investigacao
- `data/acme/`: imagens usadas pelo jogo/casos
- `data/cases-manifest.json`: lista de casos disponiveis
- `data/cases/case-br-001.json`: configuracao completa do caso
- `data/suspects/pt-br-suspects.json`: banco de suspeitos + campos de evidencia
- `docs/json-cases.md`: guia para criar novos casos

## Voz com OpenAI (opcional)

1. Abra o painel **"Voz dos personagens (OpenAI)"** dentro do jogo.
2. Informe sua API key.
3. Ajuste modelo e voz (opcional).
4. Marque **"Ativar voz OpenAI"** e salve.

Sem API key ativa, o jogo continua no modo texto.
Nota: Whisper e um modelo de transcricao. Para fala dos personagens, este MVP usa TTS da OpenAI.

## Observacoes

- A key fica salva em `localStorage` no seu navegador (apenas para ambiente local/prototipo).
- O endpoint usado para voz e `POST /v1/audio/speech`.
- O motor esta preparado para multiplos casos/languages via JSON.
