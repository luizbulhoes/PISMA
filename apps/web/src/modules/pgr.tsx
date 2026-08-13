import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Risk = Record<string, unknown>;

export function PgrPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Risk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');
  const [form, setForm] = useState({
    activity: '',
    hazard: '',
    risk: '',
    probability: 'M',
    severity: 'M',
    controls: '',
    residual: 'BAIXO',
  });

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/pgr/inventory', { token });
      setItems(emptyItems<Risk>(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar inventário PGR');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/pgr/inventory', { method: 'POST', token, body: JSON.stringify(form) });
      setMsg('Item adicionado ao inventário');
      setForm({
        activity: '',
        hazard: '',
        risk: '',
        probability: 'M',
        severity: 'M',
        controls: '',
        residual: 'BAIXO',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    }
  }

  return (
    <>
      <PageHead title="GRO / PGR" subtitle="Inventário de riscos da Obra." />
      <Err error={error} />
      <Msg text={msg} />

      {canEdit ? (
        <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Novo item</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <input
              className="field"
              placeholder="Atividade"
              required
              value={form.activity}
              onChange={(e) => setForm({ ...form, activity: e.target.value })}
            />
            <input
              className="field"
              placeholder="Perigo"
              required
              value={form.hazard}
              onChange={(e) => setForm({ ...form, hazard: e.target.value })}
            />
            <input
              className="field"
              placeholder="Risco"
              required
              value={form.risk}
              onChange={(e) => setForm({ ...form, risk: e.target.value })}
            />
            <select
              className="field"
              value={form.probability}
              onChange={(e) => setForm({ ...form, probability: e.target.value })}
            >
              <option value="B">Prob. Baixa</option>
              <option value="M">Prob. Média</option>
              <option value="A">Prob. Alta</option>
            </select>
            <select
              className="field"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              <option value="B">Sev. Baixa</option>
              <option value="M">Sev. Média</option>
              <option value="A">Sev. Alta</option>
            </select>
            <select
              className="field"
              value={form.residual}
              onChange={(e) => setForm({ ...form, residual: e.target.value })}
            >
              <option value="BAIXO">Residual baixo</option>
              <option value="MEDIO">Residual médio</option>
              <option value="ALTO">Residual alto</option>
            </select>
          </div>
          <div style={{ height: 8 }} />
          <input
            className="field"
            placeholder="Controles existentes"
            value={form.controls}
            onChange={(e) => setForm({ ...form, controls: e.target.value })}
          />
          <div style={{ height: 8 }} />
          <button className="btn btn-primary">Incluir</button>
        </form>
      ) : null}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Atividade</th>
              <th align="left">Perigo</th>
              <th align="left">Risco</th>
              <th align="left">P×S</th>
              <th align="left">Controles</th>
              <th align="left">Residual</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Inventário vazio.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={fieldOf(r, 'id')}>
                  <td>{fieldOf(r, 'activity')}</td>
                  <td>{fieldOf(r, 'hazard', 'danger')}</td>
                  <td>{fieldOf(r, 'risk')}</td>
                  <td>
                    {fieldOf(r, 'probability')} / {fieldOf(r, 'severity')}
                  </td>
                  <td>{fieldOf(r, 'controls')}</td>
                  <td>
                    <span className="badge">{fieldOf(r, 'residual', 'residual_risk')}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
