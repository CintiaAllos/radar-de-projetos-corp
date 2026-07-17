import { createClient, type Client, type InArgs } from "@libsql/client";

/** Base única e compartilhada: todos os visitantes veem e editam os mesmos dados. */
export const SHARED_OWNER = "portfolio@allos";

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL não configurada. Defina as variáveis de ambiente do Turso.",
    );
  }
  client = createClient({ url, authToken });
  return client;
}

/** Cria o esquema uma única vez por processo (idempotente). */
export function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  const db = getClient();
  schemaReady = (async () => {
    await db.batch(
      [
        `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY NOT NULL,
          owner_email TEXT NOT NULL,
          name TEXT NOT NULL,
          objective TEXT NOT NULL DEFAULT '',
          business_area TEXT NOT NULL DEFAULT '',
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          responsible TEXT NOT NULL,
          stage TEXT NOT NULL DEFAULT 'Planejamento',
          status TEXT NOT NULL DEFAULT 'Em andamento',
          observations TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects (owner_email)`,
        `CREATE TABLE IF NOT EXISTS project_actions (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Em andamento',
          progress INTEGER NOT NULL DEFAULT 0,
          observations TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0
        )`,
        `CREATE INDEX IF NOT EXISTS project_actions_project_idx ON project_actions (project_id)`,
      ],
      "write",
    );

    const info = await db.execute("PRAGMA table_info(projects)");
    const hasBusinessArea = info.rows.some(
      (row) => (row as Record<string, unknown>).name === "business_area",
    );
    if (!hasBusinessArea) {
      await db.execute(
        "ALTER TABLE projects ADD COLUMN business_area TEXT NOT NULL DEFAULT ''",
      );
    }

    // Migração: renomeia o status antigo "Obstáculo" para "Impedido".
    await db.batch(
      [
        "UPDATE projects SET status = 'Impedido' WHERE status = 'Obstáculo'",
        "UPDATE project_actions SET status = 'Impedido' WHERE status = 'Obstáculo'",
      ],
      "write",
    );
  })();
  return schemaReady;
}

/** Atalho para statements com argumentos posicionais. */
export function stmt(sql: string, args: InArgs) {
  return { sql, args };
}
