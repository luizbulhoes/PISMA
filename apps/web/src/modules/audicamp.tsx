import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

const TYPES = [
  { value: 'DEVIATION', label: 'Desvio' },
  { value: 'GOOD_PRACTICE', label: 'Boa prática' },
  { value: 'INCIDENT_WITNESSED', label: 'Risco / incidente observado' },
  { value: 'ENVIRONMENTAL', label: 'Ambiental' },
];

const CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function AudicampPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    recordType: 'DEVIATION',
    categoryCode: 'A',
    subcategoryCode: 'A1',
    area: '',
    description: '',
  });
  const canTriage = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/audicamp', { token });
      setItems(emptyItems<Row>(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar Audicamp');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/audicamp', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...form,
          subcategoryCode: `${form.categoryCode}1`,
        }),
      });
      setMsg('Registro Audicamp criado');
      setForm({
        recordType: 'DEVIATION',
        categoryCode: 'A',
        subcategoryCode: 'A1',
        area: '',
        description: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar');
    }
  }

  async function triage(id: string, action: string) {
    try {
      setError(null);
      const triageStatus =
        action === 'GERAR_PAC'
          ? 'PAC_SUGGESTED'
          : action === 'ESCALAR_RQA'
            ? 'IMMINENT_RISK'
            : action === 'ORIENTAR'
              ? 'GUIDANCE'
              : 'REGISTER_ONLY';
      await api(`/audicamp/${id}/triage`, {
        method: 'POST',
        token,
        body: JSON.stringify({ triageStatus, notes: 'Triagem operacional' }),
      });
      if (action === 'GERAR_PAC') {
        await api(`/audicamp/${id}/create-pac`, { method: 'POST', token }).catch(() => undefined);
      }
      setMsg(
        action === 'GERAR_PAC'
          ? 'PAC gerado a partir da triagem'
          : action === 'ESCALAR_RQA'
            ? 'Escalado / risco iminente'
            : `Triagem: ${action}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na triagem');
    }
  }

  return (
    <>
      <PageHead title="Audicamp" subtitle="Registro rápido de campo e triagem SST." />
      <Err error={error} />
      <Msg text={msg} />

      <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Registro rápido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <select
            className="field"
            value={form.recordType}
            onChange={(e) => setForm({ ...form, recordType: e.target.value })}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={form.categoryCode}
            onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                Categoria {c}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Área / local"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            required
          />
        </div>
        <div style={{ height: 8 }} />
        <textarea
          className="field"
          rows={3}
          required
          placeholder="Descrição objetiva (sem linguagem de culpa)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">Registrar</button>
      </form>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Registros</h3>
        {items.length === 0 ? (
          <p className="muted">Nenhum registro.</p>
        ) : (
          items.map((it) => {
            const id = fieldOf(it, 'id');
            return (
              <div
                key={id}
                style={{
                  borderTop: '1px solid #e5e7eb',
                  padding: '12px 0',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div>
                  <span className="badge">{fieldOf(it, 'record_type', 'type')}</span>{' '}
                  <span className="badge">Cat. {fieldOf(it, 'category_code', 'category')}</span>{' '}
                  <span className="muted">{fieldOf(it, 'triage_status', 'status')}</span>
                </div>
                <div>
                  <b>{fieldOf(it, 'area', 'location')}</b> — {fieldOf(it, 'description')}
                </div>
                {canTriage ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" type="button" onClick={() => void triage(id, 'ORIENTAR')}>
                      Orientar
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => void triage(id, 'ENCERRAR')}>
                      Encerrar
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => void triage(id, 'GERAR_PAC')}
                    >
                      Gerar PAC
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => void triage(id, 'ESCALAR_RQA')}
                    >
                      Escalar RQA
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
