import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useOnline } from '../offline';
import { Err, PageHead, fieldOf } from './shared';

type Summary = Record<string, unknown>;

export function DashboardPage() {
  const { token, user } = useAuth();
  const online = useOnline();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sync, setSync] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Summary>('/dashboards/summary', { token })
      .then(setSummary)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Falha ao carregar indicadores');
        setSummary(null);
      });
    void api<Summary>('/sync/status', { token })
      .then(setSync)
      .catch(() => setSync(null));
  }, [token]);

  const kpis = [
    { label: 'PTs ativas', keys: ['activePts', 'active_pts', 'ptsActive'] },
    { label: 'PTs pendentes', keys: ['pendingApprovals', 'pending_approvals', 'ptsPending'] },
    { label: 'PAC abertos', keys: ['openPac', 'open_pac', 'pacOpen'] },
    { label: 'Audicamp', keys: ['audicampOpen', 'audicamp_open', 'audicamp'] },
    { label: 'Ocorrências', keys: ['occurrencesOpen', 'occurrences_open', 'raRqa'] },
    { label: 'PREA', keys: ['preaOpen', 'prea_open', 'prea'] },
    { label: 'Resíduos', keys: ['wastePending', 'waste_pending', 'wasteLots'] },
    { label: 'Conformidade', keys: ['complianceScore', 'compliance_score', 'compliance'] },
  ];

  function valueFor(keys: string[]): string {
    if (!summary) return '—';
    for (const k of keys) {
      if (summary[k] != null && summary[k] !== '') return String(summary[k]);
    }
    return '—';
  }

  return (
    <>
      <PageHead
        title={user?.role === 'TST' || user?.role === 'MANAGER' ? 'Resumo SST / Meio Ambiente' : 'Resumo Geral'}
        subtitle={`${user?.workName ?? ''} • ${online ? 'Online' : 'Offline'}`}
        actions={
          <Link className="btn btn-ghost" to="/sync">
            Status de sync
          </Link>
        }
      />
      <Err error={error} />

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card kpi">
          <label>Obra</label>
          <b style={{ fontSize: 18 }}>{user?.workCode}</b>
          <span className="muted">{user?.workName}</span>
        </div>
        <div className="card kpi">
          <label>Papel</label>
          <b style={{ fontSize: 18 }}>{user?.role}</b>
          <span className="muted">{user?.canEmitPt ? 'Pode emitir PT' : 'Não emite PT'}</span>
        </div>
        {kpis.slice(0, 2).map((k) => (
          <div className="card kpi" key={k.label}>
            <label>{k.label}</label>
            <b>{valueFor(k.keys)}</b>
            <span className="muted">/dashboards/summary</span>
          </div>
        ))}
      </div>

      <div className="kpis">
        {kpis.slice(2).map((k) => (
          <div className="card kpi" key={k.label}>
            <label>{k.label}</label>
            <b>{valueFor(k.keys)}</b>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sincronização</h3>
        {sync ? (
          <ul className="muted">
            <li>Fila pendente: {fieldOf(sync, 'pending', 'queuePending', 'pendingCount')}</li>
            <li>Última sync: {fieldOf(sync, 'lastSyncAt', 'last_sync_at', 'updatedAt')}</li>
            <li>Estado: {fieldOf(sync, 'status', 'state')}</li>
          </ul>
        ) : (
          <p className="muted">
            {online
              ? 'Endpoint /sync/status indisponível ou sem dados.'
              : 'Offline — sync retomará ao reconectar.'}
          </p>
        )}
      </div>
    </>
  );
}

export function SyncStatusPage() {
  const { token } = useAuth();
  const online = useOnline();
  const [sync, setSync] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setSync(await api<Summary>('/sync/status', { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao consultar sync');
      setSync(null);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <>
      <PageHead
        title="Status de sincronização"
        subtitle={online ? 'Conectado' : 'Sem conexão — assinaturas bloqueadas'}
        actions={
          <button className="btn btn-primary" type="button" onClick={() => void load()} disabled={!online}>
            Atualizar
          </button>
        }
      />
      <Err error={error} />
      <div className="card">
        {!sync ? (
          <p className="muted">Sem dados de sync.</p>
        ) : (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {JSON.stringify(sync, null, 2)}
          </pre>
        )}
      </div>
    </>
  );
}
