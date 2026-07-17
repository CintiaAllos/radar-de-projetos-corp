# Radar de Projetos — versão online (base compartilhada)

Sistema em Next.js com **base única e compartilhada**: todos os visitantes veem
e editam os mesmos dados. Preserva integralmente o layout, a paleta e a
identidade ALLOS, os textos, os fluxos e todas as funcionalidades (painel com
indicadores e filtros por Projeto, Área de Negócio, Resp. Técnico e Status;
inclusão/edição/exclusão; Cronograma; Status Report; Exportar PPT).

Banco de dados: **Turso** (SQLite-compatível, hospedado).

## Publicação

O passo a passo completo (criar o banco, importar os dados e publicar na Vercel
ou na Cloudflare) está em **DEPLOY.md**.

## Rodar localmente apontando para o Turso

```bash
npm install
cp .env.example .env      # cole a URL e o token do Turso
npm run db:seed           # importa os 5 projetos iniciais (uma vez)
npm run dev               # http://localhost:3000
```

## Estrutura

- `app/radar-client.tsx`, `app/globals.css` — interface e identidade (do original, sem alterações).
- `app/api/projects/route.ts` — API (GET/POST/PUT/DELETE) sobre o Turso.
- `lib/db.ts` — conexão libSQL e criação de esquema.
- `scripts/seed.mjs` — importação inicial dos dados.
- `data/projects.json` — dados de origem.

## Variáveis de ambiente

- `TURSO_DATABASE_URL` — URL do banco (libsql://...).
- `TURSO_AUTH_TOKEN` — token de acesso ao banco.

Nunca coloque esses valores no código; use as variáveis de ambiente da hospedagem.
