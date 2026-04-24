# Deploy (hospedagem)

Este projeto é um app Node.js que serve:

- Frontend: `public/`
- API: `POST /api/leads` (salva em `data/leads.ndjson` e opcionalmente no Google Sheets)

## Opção A — Hospedar tudo junto (recomendado)

Qualquer hospedagem que rode Node funciona (Render, Railway, Fly.io, VPS, etc.).

**Comandos**

- Build: `npm install`
- Start: `npm start`

**Variáveis de ambiente (recomendadas)**

- `PORT` (a hospedagem geralmente define)
- (Opcional) Google Sheets:
  - `GOOGLE_SHEETS_SPREADSHEET_ID`
  - `GOOGLE_SHEETS_RANGE` (ex: `Leads!A:Z`)
  - `GOOGLE_SERVICE_ACCOUNT_JSON` (cole o JSON inteiro em uma linha) **ou**
  - `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` (se sua hospedagem suportar arquivo)

**Healthcheck**

- `GET /healthz` → `ok`

## Opção B — Frontend separado + API separada

1) Hospede a API (Node) em um domínio, ex: `https://api.seudominio.com`
2) No frontend, edite `public/config.js`:

```js
window.NEXUS_CONFIG = { apiBaseUrl: "https://api.seudominio.com" };
```

3) Na API, defina `CORS_ORIGIN` com o domínio do frontend (ex: `https://seudominio.com`).

## Importante sobre leads

- Em muitas hospedagens o disco é efêmero (o arquivo `data/leads.ndjson` pode sumir em deploy/restart).
- Para não perder leads, use o Google Sheets (ou depois trocamos para um banco, tipo Postgres).

## Vercel (frontend + API serverless)

Na Vercel, o `server.js` **não** roda como servidor ouvindo porta. Por isso este projeto inclui:

- Frontend: `public/` (estático)
- API: `api/leads.js` (serverless) e `api/healthz.js`
- Config: `vercel.json`

### Passos

1) Suba a pasta `nexus-site` para um repositório (GitHub/GitLab/Bitbucket).
2) Na Vercel: **New Project** → selecione o repo.
3) Em **Environment Variables** (Production + Preview) adicione:
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_SHEETS_RANGE` (ex: `Leads!A:Z`)
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (cole o JSON inteiro em uma linha)
4) Deploy.

### Teste

- Site: `/`
- Health: `/api/healthz` → `ok`
- Leads: `POST /api/leads`
