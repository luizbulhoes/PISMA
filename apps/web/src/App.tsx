import { FormEvent, useState, useEffect } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { api } from './api';
import { displayLabel, roleLabel } from './labels';
import { FirstAccessPage } from './FirstAccessPage';
import {
  CompetencyPage,
  TechnicianDetailPage,
  TechniciansPage,
  UsersAdminPage,
} from './people-pages';
import { OfflineBanner } from './offline';
import { DashboardPage, SyncStatusPage } from './modules/dashboard';
import { EquipmentDetailPage, EquipmentPage } from './modules/equipment';
import { DocumentsPage } from './modules/documents';
import { AprPage } from './modules/apr';
import { PgrPage } from './modules/pgr';
import { PtDetailPage, PtNewPage, PtsPage } from './modules/pt';
import { AudicampPage } from './modules/audicamp';
import { InspectionsPage } from './modules/inspections';
import { PacPage } from './modules/pac';
import {
  OccurrenceDetailPage,
  OccurrenceNewPage,
  OccurrencesPage,
} from './modules/occurrences';
import { PreaPage } from './modules/prea';
import { WastePage } from './modules/waste';
import { CatalogsPage } from './modules/catalogs';

function LoginPage() {
  const { login, user } = useAuth();
  const [username, setUsername] = useState('tecnico.demo');
  const [password, setPassword] = useState('ChangeMe!123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user && !user.firstLoginCompleted) return <Navigate to="/primeiro-acesso" replace />;
  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <div className="brand" style={{ color: 'var(--pisma-primary-900)', marginBottom: 12 }}>
          <div className="logo">P</div>
          <div>
            <strong>PISMA</strong>
            <div className="muted">Segurança + Meio Ambiente</div>
          </div>
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 24 }}>Acesso à plataforma</h1>
        <p className="muted">Rede interna · autenticação por Obra e papel</p>
        <label className="muted">Usuário</label>
        <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} />
        <div style={{ height: 10 }} />
        <label className="muted">Senha</label>
        <input
          className="field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <div className="error">{error}</div> : null}
        <div style={{ height: 14 }} />
        <button className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.firstLoginCompleted) return <Navigate to="/primeiro-acesso" replace />;

  const links = menuForRole(user.role);

  return (
    <div className="app-shell">
      <aside className="side">
        <div className="brand">
          <div className="logo">P</div>
          <div>
            <strong>PISMA</strong>
            <small style={{ display: 'block', color: '#b8d0dd' }}>Segurança + Meio Ambiente</small>
          </div>
        </div>
        <div className="work-box">
          <small>Obra ativa</small>
          <br />
          <b>{user.workName}</b>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <OfflineBanner />
        <header className="top">
          <div>
            <b>Plataforma Integrada de Segurança e Meio Ambiente</b>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="badge">{roleLabel(user.role)}</span>
            <span className="muted">{user.fullName}</span>
            <button className="btn btn-ghost" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

/** Mural é a tela inicial de todos os papéis. */
function menuForRole(role: string) {
  const mural = { to: '/', label: 'Mural' };
  const sync = { to: '/sync', label: 'Sincronização' };
  const resumo = { to: '/resumo', label: 'Resumo' };

  if (role === 'TECHNICIAN') {
    return [
      mural,
      { to: '/pts/nova', label: 'Nova PT' },
      { to: '/pts', label: 'Minhas PTs' },
      { to: '/apr', label: 'APRs' },
      { to: '/audicamp', label: 'Audicamp' },
      { to: '/inspecoes', label: 'Inspeções' },
      { to: '/ocorrencias', label: 'Minhas Ocorrências' },
      { to: '/prea', label: 'Emergências Ambientais' },
      { to: '/residuos', label: 'Resíduos' },
      { to: '/ficha', label: 'Minha Ficha' },
      { to: '/documentos', label: 'Procedimentos' },
      resumo,
      sync,
    ];
  }
  if (role === 'TST') {
    return [
      mural,
      { to: '/pts', label: 'Aprovações / Painel PT' },
      { to: '/apr', label: 'AR/APR' },
      { to: '/pgr', label: 'GRO/PGR' },
      { to: '/pac', label: 'PAC' },
      { to: '/audicamp', label: 'Audicamp' },
      { to: '/inspecoes', label: 'Inspeções' },
      { to: '/cadastros', label: 'Cadastros' },
      { to: '/tecnicos', label: 'Técnicos' },
      { to: '/competencia', label: 'Competências' },
      { to: '/equipamentos', label: 'Equipamentos' },
      { to: '/documentos', label: 'Procedimentos' },
      { to: '/ocorrencias', label: 'Ocorrências RA/RQA' },
      { to: '/prea', label: 'Emergências Ambientais' },
      { to: '/residuos', label: 'Resíduos' },
      { to: '/resumo', label: 'Resumo SST/MA' },
      sync,
    ];
  }
  if (role === 'SUPERVISOR') {
    return [
      mural,
      { to: '/pts', label: 'Aprovações / Painel PT' },
      { to: '/apr', label: 'AR/APR' },
      { to: '/cadastros', label: 'Cadastros' },
      { to: '/equipamentos', label: 'Equipamentos' },
      { to: '/inspecoes', label: 'Inspeções' },
      { to: '/prea', label: 'Emergências Ambientais' },
      { to: '/documentos', label: 'Procedimentos' },
      resumo,
      sync,
    ];
  }
  if (role === 'MANAGER') {
    return [
      mural,
      { to: '/pts', label: 'Aprovações / Painel PT' },
      { to: '/apr', label: 'AR/APR' },
      { to: '/pgr', label: 'GRO/PGR' },
      { to: '/pac', label: 'PAC' },
      { to: '/audicamp', label: 'Audicamp' },
      { to: '/inspecoes', label: 'Inspeções' },
      { to: '/cadastros', label: 'Cadastros' },
      { to: '/tecnicos', label: 'Técnicos' },
      { to: '/competencia', label: 'Competências' },
      { to: '/equipamentos', label: 'Equipamentos' },
      { to: '/documentos', label: 'Procedimentos' },
      { to: '/ocorrencias', label: 'Ocorrências RA/RQA' },
      { to: '/prea', label: 'Emergências Ambientais' },
      { to: '/residuos', label: 'Resíduos' },
      { to: '/resumo', label: 'Resumo executivo' },
      sync,
    ];
  }
  return [
    mural,
    { to: '/obras', label: 'Obras' },
    { to: '/usuarios', label: 'Usuários' },
    { to: '/tecnicos', label: 'Técnicos' },
    { to: '/competencia', label: 'Competência' },
    { to: '/cadastros', label: 'Cadastros' },
    { to: '/equipamentos', label: 'Equipamentos' },
    { to: '/documentos', label: 'Procedimentos' },
    { to: '/auditoria', label: 'Auditoria' },
    resumo,
    sync,
  ];
}

function NoticesPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<
    Array<{ id: string; title: string; body: string; severity: string }>
  >([]);

  useEffect(() => {
    void api<{ items: typeof items }>('/notices', { token }).then((r) => setItems(r.items));
  }, [token]);

  return (
    <>
      <h1>Mural</h1>
      <p className="muted">
        Novidades e pontos de atenção da Obra. Esta é a tela inicial de todos os usuários.
      </p>
      <div className="card" style={{ marginTop: 12 }}>
        {items.length === 0 ? (
          <p className="muted">Sem avisos no momento. Quando houver novidades, elas aparecem aqui.</p>
        ) : (
          items.map((n) => (
            <div key={n.id} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #dce8e2' }}>
              <b>
                [{displayLabel(n.severity)}] {n.title}
              </b>
              <div className="muted">{n.body}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function AuditPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [verify, setVerify] = useState<string>('');

  useEffect(() => {
    void api<{ items: typeof items }>('/audit/events', { token })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [token]);

  return (
    <>
      <h1>Auditoria</h1>
      <button
        className="btn btn-ghost"
        onClick={() =>
          void api<{ valid: boolean; checked: number }>('/audit/verify', { token })
            .then((r) =>
              setVerify(`Cadeia ${r.valid ? 'válida' : 'quebrada'} (${r.checked} eventos)`),
            )
            .catch((e) => setVerify(String(e)))
        }
      >
        Verificar integridade
      </button>
      {verify ? <p>{verify}</p> : null}
      <div className="card" style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Ação</th>
              <th align="left">Entidade</th>
              <th align="left">Resultado</th>
              <th align="left">Quando</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={String(e.id)}>
                <td>{String(e.action)}</td>
                <td>
                  {String(e.entity_type)} {e.entity_id ? `#${String(e.entity_id).slice(0, 8)}` : ''}
                </td>
                <td>{displayLabel(String(e.outcome))}</td>
                <td>{String(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function WorksPlaceholder() {
  return (
    <>
      <h1>Obras / Contratos</h1>
      <div className="card">
        <p className="muted">Cadastro avançado de Obras — em evolução (Master).</p>
      </div>
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/primeiro-acesso" element={<FirstAccessPage />} />
      <Route
        path="/*"
        element={
          <Shell>
            <Routes>
              <Route path="/" element={<NoticesPage />} />
              <Route path="/avisos" element={<Navigate to="/" replace />} />
              <Route path="/resumo" element={<DashboardPage />} />
              <Route path="/sync" element={<SyncStatusPage />} />
              <Route path="/auditoria" element={<AuditPage />} />
              <Route path="/usuarios" element={<UsersAdminPage />} />
              <Route path="/tecnicos" element={<TechniciansPage />} />
              <Route path="/tecnicos/:id" element={<TechnicianDetailPage />} />
              <Route path="/ficha" element={<TechnicianDetailPage self />} />
              <Route path="/competencia" element={<CompetencyPage />} />
              <Route path="/equipamentos" element={<EquipmentPage />} />
              <Route path="/equipamentos/:id" element={<EquipmentDetailPage />} />
              <Route path="/documentos" element={<DocumentsPage />} />
              <Route path="/pts" element={<PtsPage />} />
              <Route path="/pts/nova" element={<PtNewPage />} />
              <Route path="/pts/:id" element={<PtDetailPage />} />
              <Route path="/apr" element={<AprPage />} />
              <Route path="/pgr" element={<PgrPage />} />
              <Route path="/audicamp" element={<AudicampPage />} />
              <Route path="/inspecoes" element={<InspectionsPage />} />
              <Route path="/pac" element={<PacPage />} />
              <Route path="/ocorrencias" element={<OccurrencesPage />} />
              <Route path="/ocorrencias/nova" element={<OccurrenceNewPage />} />
              <Route path="/ocorrencias/:id" element={<OccurrenceDetailPage />} />
              <Route path="/prea" element={<PreaPage />} />
              <Route path="/residuos" element={<WastePage />} />
              <Route path="/cadastros" element={<CatalogsPage />} />
              <Route path="/obras" element={<WorksPlaceholder />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
