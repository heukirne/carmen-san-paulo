# Guia de Casos em JSON

Este projeto foi desenhado para escalar casos sem alterar o codigo fonte.

## 1) Registrar o caso no manifesto

Arquivo: `data/cases-manifest.json`

```json
{
  "defaultCaseId": "case-br-001",
  "cases": [
    {
      "id": "case-br-001",
      "label": "Caso 001: Operacao Frota Fantasma",
      "language": "pt-BR",
      "path": "data/cases/case-br-001.json"
    }
  ]
}
```

## 2) Estrutura de um caso

Arquivo exemplo: `data/cases/case-br-001.json`

Campos principais:

- `id`, `title`, `language`
- `metadata.clueTypes`: tipos de pista usados no caso
- `ui`: referencias de imagens (briefing, travel, captura, fallback)
- `settings`: prazo e custos por acao
- `suspectsData`: caminho para JSON de suspeitos
- `suspectId`: culpado real deste caso
- `route`: ordem correta dos locais
- `briefing`: texto inicial do chefe
- `ending`: textos de fim
- `locations`: lista de locais do caso

### `locations[]`

Cada local contem:

- `id`, `name`, `country`, `description`, `image`
- `travelOptions[]`: destinos disponiveis a partir dali
- `actions`: `witness`, `search`, `crimenet`

### `actions.*`

Cada acao contem:

- `speaker`: quem fala
- `text`: texto exibido
- `reveals[]`: dados revelados pela pista

Tipos de `reveals[]`:

- Destino:

```json
{
  "type": "destination",
  "value": "viena",
  "clueType": "landmark"
}
```

- Identidade:

```json
{
  "type": "identity",
  "field": "hair",
  "value": "castanho",
  "clueType": "identity"
}
```

## 3) JSON de suspeitos

Arquivo exemplo: `data/suspects/pt-br-suspects.json`

- `fields[]`: campos do painel de evidencia e opcoes permitidas
- `suspects[]`: cada suspeito com `id`, `name`, `attributes`

`attributes` deve usar exatamente os mesmos IDs definidos em `fields.id`.

## 4) Adicionar novo idioma

1. Crie um arquivo de suspeitos por idioma (`data/suspects/...`).
2. Crie um caso com `language` correspondente.
3. Cadastre no manifesto com `label` e `path`.

## 5) Dicas para extensao

- Inclua ao menos 2 pistas de identidade antes do mandado.
- Em cada local nao-final, adicione pelo menos 1 pista de destino para o proximo ponto da rota.
- Mantenha `route` e IDs dos locais consistentes.
- Coloque imagens comuns em `data/acme/`.
- Coloque imagens especificas de um caso em `data/cases/<case-id>/assets/`.
