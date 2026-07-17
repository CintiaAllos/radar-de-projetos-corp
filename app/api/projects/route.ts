import { getClient, ensureSchema, stmt, SHARED_OWNER } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS = new Set([
  "Não iniciado",
  "Em andamento",
  "Paralisado",
  "Impedido",
  "Concluído",
  "Atrasado",
  "Cancelado",
]);

type ActionInput = {
  id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  progress?: number;
  observations?: string;
};

type ProjectInput = {
  id?: string;
  name?: string;
  objective?: string;
  businessArea?: string;
  startDate?: string;
  endDate?: string;
  responsible?: string;
  stage?: string;
  status?: string;
  observations?: string;
  actions?: ActionInput[];
};

function normalizeProject(payload: ProjectInput) {
  const name = payload.name?.trim() ?? "";
  const responsible = payload.responsible?.trim() ?? "";
  const startDate = payload.startDate ?? "";
  const endDate = payload.endDate ?? "";
  const status = VALID_STATUS.has(payload.status ?? "")
    ? payload.status!
    : "Em andamento";

  if (!name || !responsible || !startDate || !endDate) {
    throw new Error("Nome, responsável técnico e período são obrigatórios.");
  }
  if (endDate < startDate) {
    throw new Error("A data final não pode ser anterior à data inicial.");
  }

  const actions = (payload.actions ?? [])
    .filter((action) => action.title?.trim())
    .map((action, index) => ({
      id: action.id ?? crypto.randomUUID(),
      title: action.title!.trim(),
      startDate: action.startDate || startDate,
      endDate: action.endDate || endDate,
      status: VALID_STATUS.has(action.status ?? "")
        ? action.status!
        : "Em andamento",
      progress: Math.min(100, Math.max(0, Number(action.progress ?? 0))),
      observations: action.observations?.trim() ?? "",
      sortOrder: index,
    }));

  return {
    name,
    objective: payload.objective?.trim() ?? "",
    businessArea: payload.businessArea?.trim() ?? "",
    startDate,
    endDate,
    responsible,
    stage: payload.stage?.trim() || "Planejamento",
    status,
    observations: payload.observations?.trim() ?? "",
    actions,
  };
}

async function listProjects() {
  const db = getClient();
  const projectsResult = await db.execute(
    "SELECT * FROM projects ORDER BY updated_at DESC",
  );
  const actionsResult = await db.execute(
    `SELECT a.* FROM project_actions a
     INNER JOIN projects p ON p.id = a.project_id
     ORDER BY a.sort_order ASC`,
  );
  const actions = actionsResult.rows as unknown as Record<string, unknown>[];

  return (projectsResult.rows as unknown as Record<string, unknown>[]).map(
    (project) => ({
      id: project.id,
      name: project.name,
      objective: project.objective,
      businessArea: project.business_area,
      startDate: project.start_date,
      endDate: project.end_date,
      responsible: project.responsible,
      stage: project.stage,
      status: project.status,
      observations: project.observations,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      actions: actions
        .filter((action) => action.project_id === project.id)
        .map((action) => ({
          id: action.id,
          title: action.title,
          startDate: action.start_date,
          endDate: action.end_date,
          status: action.status,
          progress: action.progress,
          observations: action.observations,
        })),
    }),
  );
}

export async function GET() {
  try {
    await ensureSchema();
    return Response.json({ projects: await listProjects() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao carregar projetos.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const project = normalizeProject((await request.json()) as ProjectInput);
    const db = getClient();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.batch(
      [
        stmt(
          `INSERT INTO projects
           (id, owner_email, name, objective, business_area, start_date, end_date, responsible, stage, status, observations, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            SHARED_OWNER,
            project.name,
            project.objective,
            project.businessArea,
            project.startDate,
            project.endDate,
            project.responsible,
            project.stage,
            project.status,
            project.observations,
            now,
            now,
          ],
        ),
        ...project.actions.map((action) =>
          stmt(
            `INSERT INTO project_actions
             (id, project_id, title, start_date, end_date, status, progress, observations, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              action.id,
              id,
              action.title,
              action.startDate,
              action.endDate,
              action.status,
              action.progress,
              action.observations,
              action.sortOrder,
            ],
          ),
        ),
      ],
      "write",
    );

    return Response.json({ projects: await listProjects() }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao cadastrar projeto.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as ProjectInput;
    if (!payload.id) throw new Error("Selecione um projeto para editar.");
    const project = normalizeProject(payload);
    const db = getClient();

    const existing = await db.execute(
      stmt("SELECT id FROM projects WHERE id = ?", [payload.id]),
    );
    if (!existing.rows.length) throw new Error("Projeto não encontrado.");

    await db.batch(
      [
        stmt(
          `UPDATE projects SET
             name = ?, objective = ?, business_area = ?, start_date = ?, end_date = ?, responsible = ?,
             stage = ?, status = ?, observations = ?, updated_at = ?
           WHERE id = ?`,
          [
            project.name,
            project.objective,
            project.businessArea,
            project.startDate,
            project.endDate,
            project.responsible,
            project.stage,
            project.status,
            project.observations,
            new Date().toISOString(),
            payload.id,
          ],
        ),
        stmt("DELETE FROM project_actions WHERE project_id = ?", [payload.id]),
        ...project.actions.map((action) =>
          stmt(
            `INSERT INTO project_actions
             (id, project_id, title, start_date, end_date, status, progress, observations, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              action.id,
              payload.id!,
              action.title,
              action.startDate,
              action.endDate,
              action.status,
              action.progress,
              action.observations,
              action.sortOrder,
            ],
          ),
        ),
      ],
      "write",
    );

    return Response.json({ projects: await listProjects() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao editar projeto.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Selecione um projeto para excluir.");
    const db = getClient();

    const existing = await db.execute(
      stmt("SELECT id FROM projects WHERE id = ?", [id]),
    );
    if (!existing.rows.length) throw new Error("Projeto não encontrado.");

    await db.batch(
      [
        stmt("DELETE FROM project_actions WHERE project_id = ?", [id]),
        stmt("DELETE FROM projects WHERE id = ?", [id]),
      ],
      "write",
    );

    return Response.json({ projects: await listProjects() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao excluir projeto.";
    return Response.json({ error: message }, { status: 400 });
  }
}
