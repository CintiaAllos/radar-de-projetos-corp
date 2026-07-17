import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN (arquivo .env).");
  process.exit(1);
}
const db = createClient({ url, authToken });
const SHARED_OWNER = "portfolio@allos";

await db.batch(
  [
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL, owner_email TEXT NOT NULL, name TEXT NOT NULL,
      objective TEXT NOT NULL DEFAULT '', business_area TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, responsible TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'Planejamento', status TEXT NOT NULL DEFAULT 'Em andamento',
      observations TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects (owner_email)`,
    `CREATE TABLE IF NOT EXISTS project_actions (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Em andamento', progress INTEGER NOT NULL DEFAULT 0,
      observations TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0)`,
    `CREATE INDEX IF NOT EXISTS project_actions_project_idx ON project_actions (project_id)`,
  ],
  "write",
);

const count = await db.execute("SELECT COUNT(*) AS total FROM projects");
if (Number(count.rows[0].total) > 0) {
  console.log("A base já possui dados — semeadura ignorada (nada foi duplicado).");
  process.exit(0);
}

const parsed = JSON.parse(readFileSync("data/projects.json", "utf8"));
const list = Array.isArray(parsed) ? parsed : parsed.projects || [];
const now = new Date().toISOString();
const stmts = [];
for (const p of list) {
  stmts.push({
    sql: `INSERT INTO projects
      (id, owner_email, name, objective, business_area, start_date, end_date, responsible, stage, status, observations, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [p.id, SHARED_OWNER, p.name, p.objective ?? "", p.businessArea ?? "",
      p.startDate, p.endDate, p.responsible, p.stage ?? "Planejamento",
      p.status ?? "Em andamento", p.observations ?? "", p.createdAt ?? now, p.updatedAt ?? now],
  });
  (p.actions ?? []).forEach((a, i) => {
    stmts.push({
      sql: `INSERT INTO project_actions
        (id, project_id, title, start_date, end_date, status, progress, observations, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [a.id, p.id, a.title, a.startDate, a.endDate, a.status ?? "Em andamento",
        Math.min(100, Math.max(0, Number(a.progress ?? 0))), a.observations ?? "", i],
    });
  });
}
await db.batch(stmts, "write");
console.log("Semeadura concluída: " + list.length + " projetos importados.");
