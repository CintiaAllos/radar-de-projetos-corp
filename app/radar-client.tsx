"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleDot,
  CirclePause,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileDown,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const STATUS_OPTIONS = [
  "Não iniciado",
  "Em andamento",
  "Paralisado",
  "Impedido",
  "Concluído",
  "Atrasado",
  "Cancelado",
] as const;

const BUSINESS_AREAS = [
  "ASSET Pricing",
  "Cash & Funding",
  "Compliance",
  "Contabilidade",
  "CSC Gestão de Serviços",
  "Dados - Arquitetura",
  "Dados - Governança",
  "Dados – Débito Técnico",
  "Desenvolvimento Novos Negócios",
  "Desenvolvimento Obras",
  "Gente & Performance",
  "Gestão de Sócios",
  "Hello",
  "Infogen",
  "Inteligência de Negócios",
  "Jurídico",
  "Operações – CAPEX",
  "Operações – Condomínio",
  "Operações – Estacionamento",
  "Orçamento FP&A",
  "Outros",
  "Tesouraria",
  "TI Corporativo",
] as const;

const RESPONSIBLES = [
  "David",
  "Fábio",
  "Gabriel",
  "Givanildo",
  "Marcelo",
  "Rizzetto",
  "Ygor",
] as const;

type Status = (typeof STATUS_OPTIONS)[number];
type View = "dashboard" | "create" | "edit" | "delete" | "timeline" | "timeline-all" | "report" | "export" | "export-all" | "export-timelines";

type ProjectAction = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: Status;
  progress: number;
  observations: string;
};

type Project = {
  id: string;
  name: string;
  objective: string;
  businessArea: string;
  startDate: string;
  endDate: string;
  responsible: string;
  stage: string;
  status: Status;
  observations: string;
  createdAt?: string;
  updatedAt?: string;
  actions: ProjectAction[];
};

const EMPTY_PROJECT: Project = {
  id: "",
  name: "",
  objective: "",
  businessArea: "",
  startDate: "",
  endDate: "",
  responsible: "",
  stage: "Planejamento",
  status: "Não iniciado",
  observations: "",
  actions: [],
};

function createLocalId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newAction(project?: Project): ProjectAction {
  return {
    id: createLocalId(),
    title: "",
    startDate: project?.startDate ?? "",
    endDate: project?.endDate ?? "",
    status: "Não iniciado",
    progress: 0,
    observations: "",
  };
}

function formatDate(date: string, compact = false) {
  if (!date) return "—";
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", compact
    ? { day: "2-digit", month: "short" }
    : { day: "2-digit", month: "short", year: "numeric" },
  ).format(parsed).replace(" de ", " ").replace(" de ", " ");
}

function projectProgress(project: Project) {
  if (!project.actions.length) return project.status === "Concluído" ? 100 : 0;
  return Math.round(project.actions.reduce((sum, action) => sum + action.progress, 0) / project.actions.length);
}

function plannedProgress(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const end = new Date(`${endDate}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const now = Date.now();
  if (end <= start) return now >= start ? 100 : 0;
  const pct = ((now - start) / (end - start)) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

function lastDataUpdate(projects: Project[]): string | null {
  const times = projects
    .map((project) => project.updatedAt || project.createdAt || "")
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time));
  if (!times.length) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(Math.max(...times)),
  );
}

function statusClass(status: Status) {
  return `status-${status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "-")}`;
}

function StatusBadge({ status }: { status: Status }) {
  const Icon = status === "Cancelado"
    ? X
    : status === "Não iniciado"
    ? CircleDashed
    : status === "Concluído"
    ? CheckCircle2
    : status === "Paralisado"
      ? CirclePause
      : status === "Em andamento"
        ? CircleDot
        : AlertTriangle;
  return (
    <span className={`status-badge ${statusClass(status)}`}>
      <Icon size={14} aria-hidden="true" />
      {status}
    </span>
  );
}

export default function RadarClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("Todos os projetos");
  const [businessAreaFilter, setBusinessAreaFilter] = useState("Todas as áreas");
  const [responsibleFilter, setResponsibleFilter] = useState("Todos os resp. técnicos");
  const [statusFilter, setStatusFilter] = useState("Todos os status");
  const [editPassword, setEditPassword] = useState("");
  const [pwdAsk, setPwdAsk] = useState<{ resolve: (value: string | null) => void } | null>(null);
  const [pwdValue, setPwdValue] = useState("");

  const askPassword = () =>
    new Promise<string | null>((resolve) => {
      setPwdValue("");
      setPwdAsk({ resolve });
    });
  const submitPassword = () => { pwdAsk?.resolve(pwdValue); setPwdAsk(null); };
  const cancelPassword = () => { pwdAsk?.resolve(null); setPwdAsk(null); };

  const authedFetch = async (url: string, options: RequestInit) => {
    const withPwd = (pwd: string): RequestInit => ({
      ...options,
      headers: { ...((options.headers as Record<string, string>) || {}), "x-edit-password": pwd },
    });
    let response = await fetch(url, withPwd(editPassword));
    if (response.status === 401) {
      const entered = await askPassword();
      if (entered === null) return response;
      setEditPassword(entered);
      response = await fetch(url, withPwd(entered));
    }
    return response;
  };

  const loadProjects = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const data = (await response.json()) as { projects?: Project[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os projetos.");
      setProjects(data.projects ?? []);
      setSelectedId((current) => current || data.projects?.[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os projetos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The initial request synchronizes this client dashboard with the D1-backed project base.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedProject = projects.find((project) => project.id === selectedId) ?? projects[0];

  const navigate = (nextView: View, projectId?: string) => {
    if (projectId) setSelectedId(projectId);
    setView(nextView);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveProject = async (project: Project, mode: "create" | "edit") => {
    setSaving(true);
    setError("");
    try {
      const response = await authedFetch("/api/projects", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      const data = (await response.json()) as { projects?: Project[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o projeto.");
      setProjects(data.projects ?? []);
      const saved = data.projects?.find((item) => item.name === project.name);
      setSelectedId(saved?.id ?? selectedId);
      setToast(mode === "create" ? "Projeto cadastrado com sucesso." : "Projeto atualizado com sucesso.");
      setView("dashboard");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      const response = await authedFetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await response.json()) as { projects?: Project[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir o projeto.");
      setProjects(data.projects ?? []);
      setSelectedId(data.projects?.[0]?.id ?? "");
      setToast("Projeto e suas ações foram excluídos.");
      setView("dashboard");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o projeto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar view={view} open={sidebarOpen} navigate={navigate} close={() => setSidebarOpen(false)} />
      <main className="main-area">
        <MobileHeader openMenu={() => setSidebarOpen(true)} navigate={navigate} />
        {error && (
          <div className="global-alert" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="Fechar alerta"><X size={16} /></button>
          </div>
        )}
        {loading ? (
          <LoadingState />
        ) : (
          <>
            {view === "dashboard" && (
              <Dashboard
                projects={projects}
                projectFilter={projectFilter}
                setProjectFilter={setProjectFilter}
                businessAreaFilter={businessAreaFilter}
                setBusinessAreaFilter={setBusinessAreaFilter}
                responsibleFilter={responsibleFilter}
                setResponsibleFilter={setResponsibleFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                navigate={navigate}
                refresh={() => void loadProjects()}
              />
            )}
            {view === "create" && (
              <PageFrame title="Incluir projeto" eyebrow="Gerenciar projetos" back={() => navigate("dashboard")}>
                <ProjectForm
                  initial={{ ...EMPTY_PROJECT, actions: [newAction()] }}
                  mode="create"
                  saving={saving}
                  submit={(project) => void saveProject(project, "create")}
                  cancel={() => navigate("dashboard")}
                />
              </PageFrame>
            )}
            {view === "edit" && (
              <PageFrame title="Editar projeto" eyebrow="Gerenciar projetos" back={() => navigate("dashboard")}>
                <ProjectSelector projects={projects} selectedId={selectedProject?.id ?? ""} setSelectedId={setSelectedId} />
                {selectedProject && (
                  <ProjectForm
                    key={selectedProject.id}
                    initial={selectedProject}
                    mode="edit"
                    saving={saving}
                    submit={(project) => void saveProject(project, "edit")}
                    cancel={() => navigate("dashboard")}
                  />
                )}
              </PageFrame>
            )}
            {view === "delete" && (
              <PageFrame title="Excluir projeto" eyebrow="Gerenciar projetos" back={() => navigate("dashboard")}>
                <ProjectSelector projects={projects} selectedId={selectedProject?.id ?? ""} setSelectedId={setSelectedId} />
                {selectedProject && (
                  <DeletePanel project={selectedProject} saving={saving} cancel={() => navigate("dashboard")} confirm={() => void deleteProject(selectedProject.id)} />
                )}
              </PageFrame>
            )}
            {view === "timeline" && (
              <PageFrame title="Cronograma" eyebrow="Acompanhamento" back={() => navigate("dashboard")}>
                <ProjectSelector projects={projects} selectedId={selectedProject?.id ?? ""} setSelectedId={setSelectedId} />
                {selectedProject && <Timeline project={selectedProject} />}
              </PageFrame>
            )}
            {view === "timeline-all" && (
              <PageFrame title="Cronograma Geral" eyebrow="Acompanhamento" back={() => navigate("dashboard")}>
                <GeneralTimeline projects={projects} />
              </PageFrame>
            )}
            {view === "report" && (
              <PageFrame title="Status Report" eyebrow="Acompanhamento" back={() => navigate("dashboard")}>
                <ProjectSelector projects={projects} selectedId={selectedProject?.id ?? ""} setSelectedId={setSelectedId} />
                {selectedProject && <StatusReport project={selectedProject} />}
              </PageFrame>
            )}
            {view === "export" && (
              <PageFrame title="Exportar PowerPoint" eyebrow="Relatórios" back={() => navigate("dashboard")}>
                <ProjectSelector projects={projects} selectedId={selectedProject?.id ?? ""} setSelectedId={setSelectedId} />
                {selectedProject && <ExportPpt project={selectedProject} />}
              </PageFrame>
            )}
            {view === "export-all" && (
              <PageFrame title="Exportar todos os projetos" eyebrow="Relatórios" back={() => navigate("dashboard")}>
                <ExportAllPpt projects={projects} />
              </PageFrame>
            )}
            {view === "export-timelines" && (
              <PageFrame title="Exportar Cronogramas" eyebrow="Relatórios" back={() => navigate("dashboard")}>
                <ExportTimelinesPpt projects={projects} />
              </PageFrame>
            )}
          </>
        )}
        {!loading && (
          <footer className="app-footer">
            <div>
              <Clock3 size={14} aria-hidden="true" />
              {projects.length
                ? `Última atualização dos dados: ${lastDataUpdate(projects) ?? "—"}`
                : "Nenhum dado cadastrado ainda."}
            </div>
          </footer>
        )}
      </main>
      {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
      {pwdAsk && (
        <div className="pwd-overlay" role="dialog" aria-modal="true" aria-label="Senha de edição">
          <div className="pwd-card">
            <h3>Senha de edição</h3>
            <p>Para incluir, editar ou excluir, informe a senha.</p>
            <input
              type="password"
              value={pwdValue}
              autoFocus
              placeholder="Senha"
              onChange={(event) => setPwdValue(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") submitPassword(); if (event.key === "Escape") cancelPassword(); }}
            />
            <div className="pwd-actions">
              <button type="button" className="ghost-button" onClick={cancelPassword}>Cancelar</button>
              <button type="button" className="primary-button" onClick={submitPassword}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ view, open, navigate, close }: { view: View; open: boolean; navigate: (view: View) => void; close: () => void }) {
  const item = (target: View, label: string, Icon: typeof LayoutDashboard) => (
    <button type="button" className={`nav-item ${view === target ? "active" : ""}`} onClick={() => navigate(target)}>
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      <div className={`sidebar-backdrop ${open ? "visible" : ""}`} onClick={close} aria-hidden="true" />
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Navegação principal">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></div>
          <div><strong>Radar</strong><span>de Projetos</span></div>
          <button className="close-sidebar" type="button" onClick={close} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <nav className="main-nav">
          {item("dashboard", "Visão geral", LayoutDashboard)}
          <div className="nav-group">
            <div className={`nav-group-label ${["create", "edit", "delete"].includes(view) ? "active" : ""}`}>
              <FolderKanban size={20} aria-hidden="true" />
              <span>Gerenciar projetos</span>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
            <div className="nav-submenu">
              <button type="button" className={view === "create" ? "active" : ""} onClick={() => navigate("create")}><Plus size={16} />Incluir projeto</button>
              <button type="button" className={view === "edit" ? "active" : ""} onClick={() => navigate("edit")}><Pencil size={16} />Editar projeto</button>
              <button type="button" className={view === "delete" ? "active" : ""} onClick={() => navigate("delete")}><Trash2 size={16} />Excluir projeto</button>
            </div>
          </div>
          {item("timeline", "Cronograma", CalendarDays)}
          {item("timeline-all", "Cronograma Geral", CalendarDays)}
          {item("report", "Status Report", ClipboardList)}
          {item("export", "Exportar PPT", FileDown)}
          {item("export-all", "Exportar todos", FileDown)}
          {item("export-timelines", "Exportar Cronogramas", FileDown)}
        </nav>
        <div className="allos-logo" role="img" aria-label="ALLOS" />
        <div className="sidebar-note">
          <span>PORTFÓLIO</span>
          <strong>Controle centralizado</strong>
          <p>Projetos, ações, prazos e relatórios em um único lugar.</p>
        </div>
      </aside>
    </>
  );
}

function MobileHeader({ openMenu, navigate }: { openMenu: () => void; navigate: (view: View) => void }) {
  return (
    <div className="mobile-header">
      <button type="button" onClick={openMenu} aria-label="Abrir menu"><Menu size={22} /></button>
      <strong>Radar de Projetos</strong>
      <button type="button" onClick={() => navigate("create")} aria-label="Novo projeto"><Plus size={22} /></button>
    </div>
  );
}

function PageFrame({ title, eyebrow, back, children }: { title: string; eyebrow: string; back: () => void; children: React.ReactNode }) {
  return (
    <div className="page-content">
      <header className="page-header inner-header">
        <div className="title-with-back">
          <button type="button" className="icon-button back-button" onClick={back} aria-label="Voltar"><ArrowLeft size={20} /></button>
          <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>
        </div>
      </header>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <div className="loading-logo" />
      <strong>Carregando seu portfólio</strong>
      <span>Organizando projetos, ações e prazos…</span>
    </div>
  );
}

function Dashboard({ projects, projectFilter, setProjectFilter, businessAreaFilter, setBusinessAreaFilter, responsibleFilter, setResponsibleFilter, statusFilter, setStatusFilter, navigate, refresh }: {
  projects: Project[];
  projectFilter: string;
  setProjectFilter: (value: string) => void;
  businessAreaFilter: string;
  setBusinessAreaFilter: (value: string) => void;
  responsibleFilter: string;
  setResponsibleFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  navigate: (view: View, projectId?: string) => void;
  refresh: () => void;
}) {
  const businessAreas = useMemo(() => [...new Set(projects.map((project) => project.businessArea).filter(Boolean))].sort(), [projects]);
  const responsiblePeople = useMemo(() => [...new Set(projects.map((project) => project.responsible).filter(Boolean))].sort(), [projects]);
  const filtered = useMemo(() => projects.filter((project) => {
    const matchProject = projectFilter === "Todos os projetos" || project.id === projectFilter;
    const matchArea = businessAreaFilter === "Todas as áreas" || project.businessArea === businessAreaFilter;
    const matchResponsible = responsibleFilter === "Todos os resp. técnicos" || project.responsible === responsibleFilter;
    const matchStatus = statusFilter === "Todos os status" || project.status === statusFilter;
    return matchProject && matchArea && matchResponsible && matchStatus;
  }), [projects, projectFilter, businessAreaFilter, responsibleFilter, statusFilter]);
  const atRisk = projects.filter((project) => ["Atrasado", "Impedido", "Paralisado"].includes(project.status)).length;
  const upcoming = [...projects].filter((project) => project.status !== "Concluído").sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(0, 3);
  const attention = projects.filter((project) => ["Atrasado", "Impedido", "Paralisado"].includes(project.status)).slice(0, 3);

  return (
    <div className="page-content dashboard-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">PORTFÓLIO DADOS CORPORATIVOS</span>
          <h1>Radar de Projetos</h1>
          <p>Acompanhe a saúde, os prazos e os próximos passos do portfólio.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="icon-button" aria-label="Notificações"><Bell size={20} /><span className="notification-dot" /></button>
          <div className="avatar" aria-label="Perfil">RA</div>
          <button type="button" className="primary-button" onClick={() => navigate("create")}><Plus size={20} />Novo projeto</button>
        </div>
      </header>
      <section className="kpi-grid" aria-label="Indicadores do portfólio">
        <KpiCard label="Total de projetos" value={projects.length} tone="primary" />
        <KpiCard label="Em andamento" value={projects.filter((project) => project.status === "Em andamento").length} tone="secondary" />
        <KpiCard label="Em risco / atrasados" value={atRisk} tone="danger" />
        <KpiCard label="Concluídos" value={projects.filter((project) => project.status === "Concluído").length} tone="success" />
      </section>
      <section className="filter-bar" aria-label="Filtros dos projetos">
        <label className="select-field filter-select"><span className="sr-only">Filtrar por projeto</span><select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option>Todos os projetos</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></label>
        <label className="select-field filter-select"><span className="sr-only">Filtrar por área de negócio</span><select value={businessAreaFilter} onChange={(event) => setBusinessAreaFilter(event.target.value)}><option>Todas as áreas</option>{businessAreas.map((area) => <option key={area}>{area}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></label>
        <label className="select-field filter-select"><span className="sr-only">Filtrar por responsável técnico</span><select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)}><option>Todos os resp. técnicos</option>{responsiblePeople.map((responsible) => <option key={responsible}>{responsible}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></label>
        <label className="select-field filter-select"><span className="sr-only">Filtrar por status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos os status</option>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></label>
        <button type="button" className="refresh-button" onClick={refresh}><RefreshCw size={18} />Atualizar</button>
      </section>
      <div className="dashboard-grid">
        <section className="panel project-panel">
          <div className="panel-heading"><div><h2>Projetos recentes</h2><span>{filtered.length} projeto{filtered.length === 1 ? "" : "s"} exibido{filtered.length === 1 ? "" : "s"}</span></div></div>
          <div className="table-scroll">
            <table className="projects-table">
              <thead><tr><th>Projeto</th><th>Área de Negócio</th><th>Resp. Técnico</th><th>Prazo</th><th>Progresso</th><th>Status</th><th className="actions-heading">Ações</th></tr></thead>
              <tbody>
                {filtered.map((project) => (
                  <tr key={project.id}>
                    <td><button type="button" className="project-name-button" onClick={() => navigate("report", project.id)}>{project.name}<small>{project.stage}</small></button></td>
                    <td>{project.businessArea || "Não informada"}</td>
                    <td>{project.responsible}</td>
                    <td>{formatDate(project.endDate)}</td>
                    <td><div className="progress-cell"><span>{projectProgress(project)}%</span><div className="progress-track"><div style={{ width: `${projectProgress(project)}%` }} /></div></div></td>
                    <td><StatusBadge status={project.status} /></td>
                    <td><div className="row-actions">
                      <button type="button" onClick={() => navigate("report", project.id)} title="Abrir projeto"><Eye size={16} /><span>Abrir</span></button>
                      <button type="button" onClick={() => navigate("edit", project.id)} title="Editar projeto"><Pencil size={16} /><span>Editar</span></button>
                      <button type="button" className="danger-action" onClick={() => navigate("delete", project.id)} title="Excluir projeto"><Trash2 size={16} /><span>Excluir</span></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="empty-table"><FolderKanban size={28} /><strong>Nenhum projeto encontrado</strong><span>Ajuste os filtros ou cadastre um novo projeto.</span></div>}
          </div>
        </section>
        <aside className="dashboard-aside">
          <section className="panel small-panel">
            <div className="panel-heading"><h2>Próximos prazos</h2></div>
            <div className="deadline-list">{upcoming.map((project) => <button type="button" key={project.id} onClick={() => navigate("timeline", project.id)}><CalendarDays size={19} /><span><strong>{formatDate(project.endDate, true)}</strong>{project.name}</span><ChevronRight size={16} /></button>)}</div>
          </section>
          <section className="panel small-panel attention-panel">
            <div className="panel-heading"><h2>Atenção necessária</h2><span className="count-pill">{attention.length}</span></div>
            <div className="attention-list">{attention.length ? attention.map((project) => <button type="button" key={project.id} onClick={() => navigate("report", project.id)}><AlertTriangle size={18} /><span><strong>{project.name}</strong>{project.status === "Atrasado" ? "Prazo ultrapassado" : `Status: ${project.status}`}</span></button>) : <div className="all-good"><CheckCircle2 size={20} />Nenhum projeto requer atenção.</div>}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <article className={`kpi-card ${tone}`}><div><span>{label}</span><strong>{value}</strong></div><div className="mini-bars" aria-hidden="true"><i /><i /><i /><i /></div></article>;
}

function ProjectSelector({ projects, selectedId, setSelectedId }: { projects: Project[]; selectedId: string; setSelectedId: (value: string) => void }) {
  return (
    <section className="selector-card">
      <div><span className="field-kicker">PROJETO</span><strong>Selecione um projeto da base</strong></div>
      <label className="select-field wide"><span className="sr-only">Nome do projeto</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select><ChevronDown size={18} aria-hidden="true" /></label>
    </section>
  );
}

function ProjectForm({ initial, mode, saving, submit, cancel }: { initial: Project; mode: "create" | "edit"; saving: boolean; submit: (project: Project) => void; cancel: () => void }) {
  const [draft, setDraft] = useState<Project>({ ...initial, actions: initial.actions.map((action) => ({ ...action })) });
  const [formError, setFormError] = useState("");
  const update = <K extends keyof Project>(field: K, value: Project[K]) => setDraft((current) => ({ ...current, [field]: value }));
  const updateAction = <K extends keyof ProjectAction>(id: string, field: K, value: ProjectAction[K]) => setDraft((current) => ({ ...current, actions: current.actions.map((action) => action.id === id ? { ...action, [field]: value } : action) }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.responsible.trim() || !draft.startDate || !draft.endDate) {
      setFormError("Preencha nome, responsável técnico e período do projeto.");
      return;
    }
    if (draft.endDate < draft.startDate) {
      setFormError("A data final não pode ser anterior à data inicial.");
      return;
    }
    setFormError("");
    submit(draft);
  };

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      <section className="form-card">
        <div className="section-title"><div><span>01</span><div><h2>Informações do projeto</h2><p>Defina o propósito, o período e a responsabilidade.</p></div></div></div>
        <div className="form-grid">
          <label className="field full"><span>Nome do projeto *</span><input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Ex.: Evolução do Monitor de Notas" /></label>
          <label className="field full"><span>Objetivo</span><textarea value={draft.objective} onChange={(event) => update("objective", event.target.value)} rows={3} placeholder="Descreva o resultado que este projeto deve alcançar." /></label>
          <label className="field full"><span>Área de Negócio</span><select value={draft.businessArea} onChange={(event) => update("businessArea", event.target.value)}><option value="">Selecione a área</option>{draft.businessArea && !(BUSINESS_AREAS as readonly string[]).includes(draft.businessArea) ? <option value={draft.businessArea}>{draft.businessArea}</option> : null}{BUSINESS_AREAS.map((area) => <option key={area}>{area}</option>)}</select></label>
          <label className="field"><span>Data inicial *</span><input type="date" value={draft.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
          <label className="field"><span>Data final *</span><input type="date" value={draft.endDate} min={draft.startDate} onChange={(event) => update("endDate", event.target.value)} /></label>
          <label className="field"><span>Resp. Técnico *</span><select value={draft.responsible} onChange={(event) => update("responsible", event.target.value)}><option value="">Selecione o responsável</option>{draft.responsible && !(RESPONSIBLES as readonly string[]).includes(draft.responsible) ? <option value={draft.responsible}>{draft.responsible}</option> : null}{RESPONSIBLES.map((person) => <option key={person}>{person}</option>)}</select></label>
          <label className="field"><span>Etapa atual</span><input value={draft.stage} onChange={(event) => update("stage", event.target.value)} placeholder="Ex.: Planejamento" /></label>
          <label className="field"><span>Status</span><select value={draft.status} onChange={(event) => update("status", event.target.value as Status)}>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="field full"><span>Observações</span><textarea value={draft.observations} onChange={(event) => update("observations", event.target.value)} rows={3} placeholder="Registre decisões, dependências ou informações relevantes." /></label>
        </div>
      </section>
      <section className="form-card actions-form-card">
        <div className="section-title action-title"><div><span>02</span><div><h2>Ações e datas</h2><p>Inclua as entregas que formarão o cronograma e o status report.</p></div></div><button type="button" className="secondary-button" onClick={() => update("actions", [...draft.actions, newAction(draft)])}><Plus size={18} />Adicionar ação</button></div>
        <div className="action-editor-list">
          {draft.actions.map((action, index) => {
            const planned = plannedProgress(action.startDate, action.endDate);
            return (
            <article className="action-editor" key={action.id}>
              <div className="action-editor-head"><strong>Ação {index + 1}</strong><button type="button" onClick={() => update("actions", draft.actions.filter((item) => item.id !== action.id))} aria-label={`Remover ação ${index + 1}`}><Trash2 size={17} />Remover</button></div>
              <div className="action-form-grid">
                <label className="field action-name"><span>Descrição da ação</span><input value={action.title} onChange={(event) => updateAction(action.id, "title", event.target.value)} placeholder="O que precisa ser realizado?" /></label>
                <label className="field"><span>Início</span><input type="date" value={action.startDate} min={draft.startDate} max={draft.endDate || undefined} onChange={(event) => updateAction(action.id, "startDate", event.target.value)} /></label>
                <label className="field"><span>Fim</span><input type="date" value={action.endDate} min={action.startDate || draft.startDate} max={draft.endDate || undefined} onChange={(event) => updateAction(action.id, "endDate", event.target.value)} /></label>
                <label className="field"><span>Status da Ação</span><select value={action.status} onChange={(event) => updateAction(action.id, "status", event.target.value as Status)}>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
                <div className="field progress-field"><span>Progresso Atual: {action.progress}%</span><input type="range" min="0" max="100" step="1" value={action.progress} onChange={(event) => updateAction(action.id, "progress", Number(event.target.value))} /><span className="planned-label">Progresso Planejado: {planned === null ? "—" : `${planned}%`}</span><div className="planned-track" aria-hidden="true"><div style={{ width: `${planned ?? 0}%` }} /></div></div>
                <label className="field full"><span>Observações da ação</span><input value={action.observations} onChange={(event) => updateAction(action.id, "observations", event.target.value)} placeholder="Dependências, impedimentos ou comentários." /></label>
              </div>
            </article>
            );
          })}
          {!draft.actions.length && <div className="empty-actions"><ClipboardList size={28} /><strong>Nenhuma ação cadastrada</strong><span>Use “Adicionar ação” para construir o cronograma.</span></div>}
        </div>
      </section>
      {formError && <div className="inline-error" role="alert"><AlertCircle size={17} />{formError}</div>}
      <div className="form-footer"><button type="button" className="ghost-button" onClick={cancel}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}><Save size={18} />{saving ? "Salvando…" : mode === "create" ? "Cadastrar projeto" : "Salvar alterações"}</button></div>
    </form>
  );
}

function DeletePanel({ project, saving, cancel, confirm }: { project: Project; saving: boolean; cancel: () => void; confirm: () => void }) {
  const [typedName, setTypedName] = useState("");
  const ready = typedName.trim() === project.name;
  return (
    <section className="delete-card">
      <div className="danger-icon"><Trash2 size={26} /></div>
      <div className="delete-copy"><span className="field-kicker">EXCLUSÃO DEFINITIVA</span><h2>{project.name}</h2><p>Esta ação removerá o projeto e suas <strong>{project.actions.length} ações vinculadas</strong>. O cronograma e o status report também deixarão de existir.</p></div>
      <div className="delete-summary"><div><span>Área de Negócio</span><strong>{project.businessArea || "Não informada"}</strong></div><div><span>Resp. Técnico</span><strong>{project.responsible}</strong></div><div><span>Período</span><strong>{formatDate(project.startDate)} — {formatDate(project.endDate)}</strong></div><div><span>Status</span><StatusBadge status={project.status} /></div></div>
      <label className="field confirm-field"><span>Digite <strong>{project.name}</strong> para confirmar:</span><input value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder="Nome completo do projeto" autoComplete="off" /></label>
      <div className="form-footer"><button type="button" className="ghost-button" onClick={cancel}>Cancelar</button><button type="button" className="delete-button" disabled={!ready || saving} onClick={confirm}><Trash2 size={18} />{saving ? "Excluindo…" : "Excluir projeto"}</button></div>
    </section>
  );
}

function Timeline({ project, capture = false }: { project: Project; capture?: boolean }) {
  const dayMs = 86400000;
  const weekMs = 7 * dayMs;
  const start = new Date(`${project.startDate}T12:00:00`).getTime();
  const endRaw = new Date(`${project.endDate}T12:00:00`).getTime();
  const safeStart = Number.isFinite(start) ? start : Date.now();
  const safeEnd = Number.isFinite(endRaw) && endRaw >= safeStart ? endRaw : safeStart;
  const totalDays = Math.max(1, Math.floor((safeEnd - safeStart) / dayMs) + 1);
  const weekCount = Math.max(1, Math.ceil(totalDays / 7));
  const span = weekCount * weekMs;
  const fmtDM = (time: number) =>
    new Date(time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const weekStart = safeStart + index * weekMs;
    const weekEnd = Math.min(weekStart + 6 * dayMs, safeEnd);
    return { key: weekStart, label: `${fmtDM(weekStart)} a ${fmtDM(weekEnd)}` };
  });
  return (
    <section className={`timeline-card ${capture ? "capture-card" : ""}`}>
      <div className="report-topline"><div><span className="field-kicker">CRONOGRAMA DO PROJETO</span><h2>{project.name}</h2><p>{project.objective}</p></div><StatusBadge status={project.status} /></div>
      <div className="project-meta-row"><div><span>Área de Negócio</span><strong>{project.businessArea || "Não informada"}</strong></div><div><span>Resp. Técnico</span><strong>{project.responsible}</strong></div><div><span>Etapa</span><strong>{project.stage}</strong></div><div><span>Período</span><strong>{formatDate(project.startDate)} — {formatDate(project.endDate)}</strong></div><div><span>Progresso</span><strong>{projectProgress(project)}%</strong></div></div>
      <div className="gantt-wrap" style={{ ["--cols"]: weekCount } as React.CSSProperties}>
        <div className="gantt-header"><div>Ação</div><div className="gantt-dates">{weeks.map((week) => <span key={week.key}>{week.label}</span>)}</div></div>
        <div className="gantt-body">
          {project.actions.map((action) => {
            const rawActionStart = new Date(`${action.startDate}T12:00:00`).getTime();
            const rawActionEnd = new Date(`${action.endDate}T12:00:00`).getTime();
            const actionStart = Number.isFinite(rawActionStart) ? rawActionStart : safeStart;
            const actionEnd = Number.isFinite(rawActionEnd) ? rawActionEnd : actionStart;
            const left = Math.max(0, Math.min(100, ((actionStart - safeStart) / span) * 100));
            const width = Math.max((dayMs / span) * 100, Math.min(100 - left, ((actionEnd - actionStart + dayMs) / span) * 100));
            return <div className="gantt-row" key={action.id}><div className="gantt-label"><strong>{action.title}</strong><span>{action.progress}% • {action.status}</span></div><div className="gantt-track"><div className="gantt-grid-lines">{weeks.map((week) => <i key={week.key} />)}</div><div className={`gantt-bar ${statusClass(action.status)}`} style={{ left: `${left}%`, width: `${width}%` }}><span>{action.progress}%</span></div></div></div>;
          })}
        </div>
      </div>
      <div className="timeline-legend"><strong>Legenda</strong>{STATUS_OPTIONS.map((status) => <span key={status}><i className={statusClass(status)} />{status}</span>)}</div>
    </section>
  );
}

function GeneralTimeline({ projects }: { projects: Project[] }) {
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [projects],
  );

  if (!sortedProjects.length) {
    return <div className="empty-actions"><CalendarDays size={28} /><strong>Nenhum projeto cadastrado</strong><span>Os cronogramas aparecerão aqui após o cadastro dos projetos.</span></div>;
  }

  return (
    <div className="general-timeline-list">
      {sortedProjects.map((project) => <Timeline project={project} key={project.id} />)}
    </div>
  );
}

function StatusReport({ project, capture = false }: { project: Project; capture?: boolean }) {
  const counts = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, project.actions.filter((action) => action.status === status).length])) as Record<Status, number>;
  const progress = projectProgress(project);
  const attention = counts.Atrasado + counts.Impedido + counts.Paralisado;
  return (
    <section className={`status-report ${capture ? "capture-card" : ""}`}>
      <div className="report-topline"><div><span className="field-kicker">STATUS REPORT</span><h2>{project.name}</h2><p>Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}</p></div><StatusBadge status={project.status} /></div>
      <div className="report-summary-grid">
        <article><span>Total de ações</span><strong>{project.actions.length}</strong><small>no cronograma</small></article>
        <article className="success"><span>Concluídas</span><strong>{counts.Concluído}</strong><small>{project.actions.length ? Math.round((counts.Concluído / project.actions.length) * 100) : 0}% das ações</small></article>
        <article className="secondary"><span>Em andamento</span><strong>{counts["Em andamento"]}</strong><small>execução ativa</small></article>
        <article className="danger"><span>Requer atenção</span><strong>{attention}</strong><small>atrasos ou impedimentos</small></article>
      </div>
      <div className="report-body-grid">
        <article className="health-card"><div className="health-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><span>saúde geral</span></div></div><div className="health-copy"><span className="field-kicker">VISÃO EXECUTIVA</span><h3>{attention ? "Projeto requer acompanhamento" : "Projeto dentro do esperado"}</h3><p>{project.observations || "Nenhuma observação geral registrada."}</p><div className="health-meta"><span><Clock3 size={16} />Prazo: {formatDate(project.endDate)}</span><span><FolderKanban size={16} />Área: {project.businessArea || "Não informada"}</span><span><FolderKanban size={16} />Resp. Técnico: {project.responsible}</span><span><FolderKanban size={16} />Etapa: {project.stage}</span></div></div></article>
        <article className="status-distribution"><h3>Distribuição das ações</h3>{STATUS_OPTIONS.map((status) => <div className="distribution-row" key={status}><span><i className={statusClass(status)} />{status}</span><strong>{counts[status]}</strong><div><i className={statusClass(status)} style={{ width: `${project.actions.length ? (counts[status] / project.actions.length) * 100 : 0}%` }} /></div></div>)}</article>
      </div>
      <article className="actions-status-list"><div className="panel-heading"><div><h3>Acompanhamento das ações</h3><span>Resumo detalhado com comentários e impedimentos</span></div></div><div className="report-action-grid">{project.actions.map((action) => <div className="report-action" key={action.id}><div><StatusBadge status={action.status} /><strong>{action.title}</strong><p>{action.observations || "Sem comentários adicionais."}</p></div><div className="report-action-side"><span>{formatDate(action.startDate, true)} — {formatDate(action.endDate, true)}</span><strong>{action.progress}%</strong></div></div>)}</div></article>
    </section>
  );
}

function ExportPpt({ project }: { project: Project }) {
  const [exporting, setExporting] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const exportSlides = async () => {
    if (!timelineRef.current || !reportRef.current) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const [{ default: html2canvas }, { default: PptxGenJS }] = await Promise.all([import("html2canvas"), import("pptxgenjs")]);
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Radar de Projetos";
      pptx.subject = `Cronograma e Status Report — ${project.name}`;
      pptx.title = project.name;
      for (const element of [timelineRef.current, reportRef.current]) {
        const canvas = await html2canvas(element, { scale: 1.4, backgroundColor: "#E5DED4", logging: false, useCORS: true });
        const slide = pptx.addSlide();
        slide.background = { color: "E5DED4" };
        slide.addImage({ data: canvas.toDataURL("image/png"), x: 0, y: 0, w: 13.333, h: 7.5 });
      }
      const filename = `${project.name.replace(/[^a-zA-Z0-9À-ÿ]+/g, "-").replace(/^-|-$/g, "")}-status.pptx`;
      await pptx.writeFile({ fileName: filename });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <section className="export-card">
        <div className="export-illustration"><FileDown size={38} /></div>
        <div><span className="field-kicker">POWERPOINT</span><h2>Apresentação pronta para acompanhamento</h2><p>O arquivo será gerado com dois slides em formato 16:9: o cronograma visual e o status report executivo do projeto selecionado.</p><div className="export-includes"><span><CheckCircle2 size={17} />Cronograma com ações e datas</span><span><CheckCircle2 size={17} />Indicadores e saúde do projeto</span><span><CheckCircle2 size={17} />Comentários, riscos e progresso</span></div></div>
        <button type="button" className="primary-button export-button" onClick={() => void exportSlides()} disabled={exporting}><Download size={19} />{exporting ? "Gerando apresentação…" : "Gerar e baixar PPT"}</button>
      </section>
      <div className="export-preview-grid"><article><span>SLIDE 01</span><CalendarDays size={24} /><strong>Cronograma</strong><p>Linha do tempo das ações com cores por status.</p></article><article><span>SLIDE 02</span><ClipboardList size={24} /><strong>Status Report</strong><p>Visão macro e executiva da saúde do projeto.</p></article></div>
      <div className="capture-source" aria-hidden="true">
        <div ref={timelineRef}><Timeline project={project} capture /></div>
        <div ref={reportRef}><StatusReport project={project} capture /></div>
      </div>
    </>
  );
}

function ExportAllPpt({ projects }: { projects: Project[] }) {
  const [exporting, setExporting] = useState(false);
  const captureSourceRef = useRef<HTMLDivElement>(null);
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [projects],
  );

  const exportSlides = async () => {
    if (!captureSourceRef.current || !sortedProjects.length) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const [{ default: html2canvas }, { default: PptxGenJS }] = await Promise.all([import("html2canvas"), import("pptxgenjs")]);
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Radar de Projetos";
      pptx.subject = "Cronogramas e Status Reports de todos os projetos";
      pptx.title = "Radar de Projetos — Portfólio completo";

      const elements = Array.from(captureSourceRef.current.querySelectorAll<HTMLElement>("[data-export-slide]"));
      for (const element of elements) {
        const canvas = await html2canvas(element, { scale: 1.4, backgroundColor: "#E5DED4", logging: false, useCORS: true });
        const slide = pptx.addSlide();
        slide.background = { color: "E5DED4" };
        slide.addImage({ data: canvas.toDataURL("image/png"), x: 0, y: 0, w: 13.333, h: 7.5 });
      }
      await pptx.writeFile({ fileName: "Radar-de-Projetos-Portifolio-Completo.pptx" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <section className="export-card">
        <div className="export-illustration"><FileDown size={38} /></div>
        <div><span className="field-kicker">POWERPOINT COMPLETO</span><h2>Todos os projetos em uma única apresentação</h2><p>O arquivo reunirá os {sortedProjects.length} projetos em ordem alfabética, com um slide de cronograma e um slide de status report para cada projeto.</p><div className="export-includes"><span><CheckCircle2 size={17} />Projetos em ordem alfabética</span><span><CheckCircle2 size={17} />{sortedProjects.length * 2} slides no total</span><span><CheckCircle2 size={17} />Cronograma e visão executiva</span></div></div>
        <button type="button" className="primary-button export-button" onClick={() => void exportSlides()} disabled={exporting || !sortedProjects.length}><Download size={19} />{exporting ? "Gerando apresentação…" : "Gerar PPT completo"}</button>
      </section>
      <div className="export-preview-grid"><article><span>ORDEM DOS PROJETOS</span><FolderKanban size={24} /><strong>Classificação alfabética</strong><p>{sortedProjects.map((project) => project.name).join(" • ") || "Nenhum projeto cadastrado."}</p></article><article><span>CONTEÚDO POR PROJETO</span><ClipboardList size={24} /><strong>2 slides por projeto</strong><p>Cronograma visual seguido do status report executivo.</p></article></div>
      <div className="capture-source" ref={captureSourceRef} aria-hidden="true">
        {sortedProjects.flatMap((project) => [
          <div data-export-slide key={`${project.id}-timeline`}><Timeline project={project} capture /></div>,
          <div data-export-slide key={`${project.id}-report`}><StatusReport project={project} capture /></div>,
        ])}
      </div>
    </>
  );
}

function ExportTimelinesPpt({ projects }: { projects: Project[] }) {
  const [exporting, setExporting] = useState(false);
  const captureSourceRef = useRef<HTMLDivElement>(null);
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
    [projects],
  );

  const exportSlides = async () => {
    if (!captureSourceRef.current || !sortedProjects.length) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const [{ default: html2canvas }, { default: PptxGenJS }] = await Promise.all([import("html2canvas"), import("pptxgenjs")]);
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "Radar de Projetos";
      pptx.subject = "Cronogramas de todos os projetos";
      pptx.title = "Radar de Projetos — Cronogramas";

      const elements = Array.from(captureSourceRef.current.querySelectorAll<HTMLElement>("[data-export-slide]"));
      for (const element of elements) {
        const canvas = await html2canvas(element, { scale: 1.4, backgroundColor: "#E5DED4", logging: false, useCORS: true });
        const slide = pptx.addSlide();
        slide.background = { color: "E5DED4" };
        slide.addImage({ data: canvas.toDataURL("image/png"), x: 0, y: 0, w: 13.333, h: 7.5 });
      }
      await pptx.writeFile({ fileName: "Radar-de-Projetos-Cronogramas.pptx" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <section className="export-card">
        <div className="export-illustration"><CalendarDays size={38} /></div>
        <div><span className="field-kicker">POWERPOINT DE CRONOGRAMAS</span><h2>Todos os cronogramas em uma única apresentação</h2><p>O arquivo reproduzirá a visão do Cronograma Geral, com um slide de timeline para cada projeto, seguindo a ordem alfabética.</p><div className="export-includes"><span><CheckCircle2 size={17} />Projetos em ordem alfabética</span><span><CheckCircle2 size={17} />{sortedProjects.length} slides no total</span><span><CheckCircle2 size={17} />Todas as ações e respectivas datas</span></div></div>
        <button type="button" className="primary-button export-button" onClick={() => void exportSlides()} disabled={exporting || !sortedProjects.length}><Download size={19} />{exporting ? "Gerando cronogramas…" : "Gerar PPT de cronogramas"}</button>
      </section>
      <div className="export-preview-grid"><article><span>ORDEM DOS PROJETOS</span><FolderKanban size={24} /><strong>Classificação alfabética</strong><p>{sortedProjects.map((project) => project.name).join(" • ") || "Nenhum projeto cadastrado."}</p></article><article><span>CONTEÚDO</span><CalendarDays size={24} /><strong>1 cronograma por slide</strong><p>Timeline completa com ações, prazos, progresso, status e legendas.</p></article></div>
      <div className="capture-source" ref={captureSourceRef} aria-hidden="true">
        {sortedProjects.map((project) => <div data-export-slide key={project.id}><Timeline project={project} capture /></div>)}
      </div>
    </>
  );
}
