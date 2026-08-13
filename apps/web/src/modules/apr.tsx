import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Apr = Record<string, unknown>;

export function AprPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Apr[]>([]);
  const [pts, setPts] = useState<Apr[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    activity: '',
    area: '',
    hazards: '',
    controls: '',
  });
  const [importPtId, setImportPtId] = useState('');
  const [importAprId, setImportAprId] = useState('');
  const canCreate = ['TECHNICIAN', 'TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/apr', { token });
      setItems(emptyItems<Apr>(r));
      const p = await api<unknown>('/pts', { token }).catch(() => ({ items: [] }));
      setPts(emptyItems<Apr>(p));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar APR');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/apr', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...form,
          hazards: form.hazards.split('\n').filter(Boolean),
          controls: form.controls.split('\n').filter(Boolean),
        }),
      });
      setMsg('APR criada');
      setForm({ title: '', activity: '', area: '', hazards: '', controls: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar APR');
    }
  }

  async function importToPt(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/pts/${importPtId}/apr`, {
        method: 'POST',
        token,
        body: JSON.stringify({ aprId: importAprId }),
      });
      setMsg('APR vinculada à PT');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao importar APR para PT');
    }
  }

  const title = useMemo(
    () => (user?.role === 'TECHNICIAN' ? 'Minhas APRs' : 'AR / APR Digital'),
    [user?.role],
  );

  return (
    <>
      <PageHead title={title} subtitle="Análise de risco estruturada e vinculável à PT." />
      <Err error={error} />
      <Msg text={msg} />

      {canCreate ? (
        <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Nova APR</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              className="field"
              placeholder="Título"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="field"
              placeholder="Atividade"
              required
              value={form.activity}
              onChange={(e) => setForm({ ...form, activity: e.target.value })}
            />
            <input
              className="field"
              placeholder="Área"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>
          <div style={{ height: 8 }} />
          <textarea
            className="field"
            rows={3}
            placeholder="Perigos (um por linha)"
            value={form.hazards}
            onChange={(e) => setForm({ ...form, hazards: e.target.value })}
          />
          <div style={{ height: 8 }} />
          <textarea
            className="field"
            rows={3}
            placeholder="Controles (um por linha)"
            value={form.controls}
            onChange={(e) => setForm({ ...form, controls: e.target.value })}
          />
          <div style={{ height: 8 }} />
          <button className="btn btn-primary">Salvar APR</button>
        </form>
      ) : null}

      <div className="card" style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Título</th>
              <th align="left">Atividade</th>
              <th align="left">Status</th>
              <th align="left">Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  Nenhuma APR.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={fieldOf(a, 'id')}>
                  <td>{fieldOf(a, 'title', 'name')}</td>
                  <td>{fieldOf(a, 'activity', 'activity_name')}</td>
                  <td>
                    <span className="badge">{fieldOf(a, 'status')}</span>
                  </td>
                  <td>{fieldOf(a, 'updatedAt', 'updated_at', 'created_at')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={importToPt}>
        <h3 style={{ marginTop: 0 }}>Importar APR para PT</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select className="field" required value={importAprId} onChange={(e) => setImportAprId(e.target.value)}>
            <option value="">APR…</option>
            {items.map((a) => (
              <option key={fieldOf(a, 'id')} value={fieldOf(a, 'id')}>
                {fieldOf(a, 'title', 'name')}
              </option>
            ))}
          </select>
          <select className="field" required value={importPtId} onChange={(e) => setImportPtId(e.target.value)}>
            <option value="">PT destino…</option>
            {pts.map((p) => (
              <option key={fieldOf(p, 'id')} value={fieldOf(p, 'id')}>
                {fieldOf(p, 'number', 'pt_number', 'os')} — {fieldOf(p, 'description', 'title')}
              </option>
            ))}
          </select>
        </div>
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">Vincular</button>{' '}
        <Link className="btn btn-ghost" to="/pts">
          Ir para PTs
        </Link>
      </form>
    </>
  );
}
