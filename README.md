# Nexus Assessoria — Site

Site estático + backend simples em Node.js (sem dependências) para receber os leads do formulário.

## Rodar localmente

No PowerShell:

```powershell
cd C:\Users\Blank\Documents\nexus-site
node .\server.js
```

Abra `http://localhost:3000`.

No CMD (recomendado):

```bat
cd C:\Users\Blank\Documents\nexus-site
npm run dev
```

## Leads

- Endpoint: `POST /api/leads`
- Armazenamento local: `data/leads.ndjson` (1 lead por linha em JSON)

## Google Sheets (opcional)

Você pode enviar cada lead também para uma planilha do Google (append em linhas).

### Passo a passo

1) Crie uma Service Account no Google Cloud e baixe o JSON.
2) No Google Sheets, compartilhe a planilha com o e-mail da Service Account (permissão de Editor).
3) Crie uma aba chamada `Leads` (ou ajuste o `GOOGLE_SHEETS_RANGE`).
4) Copie `env.example` para `.env` e preencha.
5) Instale dependência (no **CMD**, não PowerShell):

```bat
cd C:\Users\Blank\Documents\nexus-site
npm install
```

6) Rode:

```bat
npm run dev
```

### Colunas enviadas

`createdAt`, `id`, `nome`, `telefone`, `email`, `empresa`, `segmento`, `faturamento`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ip`, `userAgent`, `referer`

## Hospedagem

Veja `DEPLOY.md`.
