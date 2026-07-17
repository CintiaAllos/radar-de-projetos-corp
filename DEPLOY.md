# Guia de publicação — Radar de Projetos (base compartilhada)

Este projeto é a versão online com **base única compartilhada**: todos os
visitantes veem e editam os mesmos dados. Ele usa **Turso** (banco
SQLite-compatível, hospedado) e roda em Next.js.

O que eu (Claude) já deixei pronto: todo o código, o esquema do banco e o
script que importa os dados iniciais. O que só você pode fazer: criar as contas,
gerar as credenciais e confirmar a publicação. Os passos abaixo são exatamente
esses.

---

## Parte 1 — Banco de dados (Turso) — comum a qualquer hospedagem

1. Crie uma conta em https://turso.tech (o plano gratuito é suficiente e não
   pede cartão).
2. Crie um banco (pelo painel ou pela CLI). Pelo painel: "Create Database",
   escolha um nome (ex.: `radar-de-projetos`) e uma região próxima do Brasil.
3. Copie dois valores do banco:
   - a **Database URL** (algo como `libsql://radar-de-projetos-SEU-USER.turso.io`);
   - um **Auth Token** (gere em "Tokens" / "Create Token").
4. Guarde esses dois valores — serão as variáveis `TURSO_DATABASE_URL` e
   `TURSO_AUTH_TOKEN`.

## Parte 2 — Importar os dados iniciais (uma única vez)

Isto roda na sua máquina e popula o banco com os 5 projetos de `data/projects.json`
(sem duplicar; se já houver dados, ele não faz nada).

```bash
cd radar-de-projetos
npm install
cp .env.example .env
# edite o .env e cole a URL e o token do Turso
npm run db:seed
```

Você deve ver "Semeadura concluída: 5 projetos importados."

## Parte 3 — Publicar

Escolha **uma** das opções.

### Opção A — Vercel (mais simples)

> Atenção: o plano gratuito (Hobby) da Vercel é para uso **não comercial**.
> Para uma ferramenta interna de empresa, o correto é o plano Pro (pago) ou usar
> a Opção B (Cloudflare), que permite uso comercial no gratuito.

1. Suba este projeto para um repositório no GitHub.
2. Crie conta em https://vercel.com e clique em "Add New… → Project".
3. Importe o repositório. A Vercel detecta Next.js automaticamente.
4. Em "Environment Variables", adicione `TURSO_DATABASE_URL` e
   `TURSO_AUTH_TOKEN` com os valores do Turso.
5. Clique em "Deploy". Ao final, você recebe a URL pública para compartilhar.

### Opção B — Cloudflare (gratuito, permite uso comercial)

1. Suba o projeto para um repositório no GitHub.
2. Crie conta em https://dash.cloudflare.com e vá em "Workers & Pages".
3. "Create → Pages → Connect to Git" e selecione o repositório.
4. Em variáveis de ambiente, adicione `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`.
5. Publique. (Para Next.js na Cloudflare pode ser necessário o adaptador
   `@opennextjs/cloudflare`; me avise que eu já deixo o projeto configurado
   para esse caminho.)

---

## Manutenção

- Os dados vivem no Turso. Inclusões, edições e exclusões feitas na interface
  são gravadas lá e aparecem para todos.
- Backup: o Turso mantém backups automáticos; você também pode exportar quando
  quiser pelo painel/CLI.
- Segurança: as credenciais ficam só nas variáveis de ambiente, nunca no código.

## Observação sobre escrita pública

Hoje a leitura e a escrita são abertas a quem tiver o link. Se em algum momento
você quiser exigir login para incluir/editar/excluir (mantendo a leitura
pública), me diga — eu adiciono uma proteção simples por senha ou um login por
e-mail, sem mudar o restante.
