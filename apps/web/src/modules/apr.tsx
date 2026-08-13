import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ACTIVITY_NATURES, defaultNaturesMap, roleLabel, type NatureFill } from '../labels';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Apr = Record<string, unknown>;

const APR_TECH_SLOTS = ['TECHNICIAN_1', 'TECHNICIAN_2', 'TECHNICIAN_3', 'TECHNICIAN_4'] as const;

export function AprPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Apr[]>([]);
  const [locations, setLocations] = useState<Apr[]>([]);
  const [technicians, setTechnicians] = useState<Apr[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [form, setForm] = useState({
    title: '',
    activity: '',
    locationId: '',
    hazards: '',
    controls: '',
    natures: defaultNaturesMap() as Record<string, NatureFill>,
    technicianApproverIds: [] as string[],
  });
  const canCreate = ['TST', 'SUPERVISOR', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/apr', { token });
      setItems(emptyItems<Apr>(r));
      const l = await api<unknown>('/locations', { token }).catch(() => ({ items: [] }));
      setLocations(emptyItems<Apr>(l));
      const t = await api<unknown>('/technicians', { token }).catch(() => ({ items: [] }));
      setTechnicians(emptyItems<Apr>(t));
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
      const loc = locations.find((x) => fieldOf(x, 'id') === form.locationId);
      await api('/apr', {
        method: 'POST',
        token,
        body: JSON.stringify({
          title: form.title,
          activity: form.activity,
          area: loc ? fieldOf(loc, 'name') : '',
          locationId: form.locationId || undefined,
          hazards: form.hazards.split('\n').filter(Boolean),
          controls: form.controls.split('\n').filter(Boolean),
          natures: form.natures,
          technicianApproverIds: form.technicianApproverIds.slice(0, 4),
        }),
      });
      setMsg('APR criada com condições de natureza do local');
      setForm({
        title: '',
        activity: '',
        locationId: '',
        hazards: '',
        controls: '',
        natures: defaultNaturesMap(),
        technicianApproverIds: [],
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar APR');
    }
  }

  async function approveSlot(aprId: string, slot: string) {
    try {
      await api(`/apr/${aprId}/approvals`, {
        method: 'POST',
        token,
        body: JSON.stringify({ slot, pin, decision: 'APPROVED' }),
      });
      setMsg(`Aprovação ${slot} registrada`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na aprovação da APR');
    }
  }

  const title = useMemo(
    () => (user?.role === 'TECHNICIAN' ? 'APRs' : 'AR / APR Digital'),
    [user?.role],
  );

  return (
    <>
      <PageHead
        title={title}
        subtitle="APR define naturezas do local. Somente TST, Supervisor ou Gestor cadastram."
      />
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
            <select
              className="field"
              required
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
            >
              <option value="">Local analisado…</option>
              {locations.map((l) => (
                <option key={fieldOf(l, 'id')} value={fieldOf(l, 'id')}>
                  {fieldOf(l, 'code')} — {fieldOf(l, 'name')}
                </option>
              ))}
            </select>
          </div>
          <div style={{ height: 12 }} />
          <b>Condições de natureza do local</b>
          <p className="muted">Itens marcados como Aplicável serão automarcados e travados nas PTs vinculadas.</p>
          <div className="nature-grid">
            {ACTIVITY_NATURES.map((n) => (
              <div key={n.code} className="nature-row">
                <b>{n.label}</b>
                <label>
                  <input
                    type="radio"
                    name={`apr-${n.code}`}
                    checked={form.natures[n.code] === 'APPLICABLE'}
                    onChange={() =>
                      setForm({
                        ...form,
                        natures: { ...form.natures, [n.code]: 'APPLICABLE' },
                      })
                    }
                  />{' '}
                  Aplicável
                </label>
                <label>
                  <input
                    type="radio"
                    name={`apr-${n.code}`}
                    checked={form.natures[n.code] === 'NA'}
                    onChange={() =>
                      setForm({
                        ...form,
                        natures: { ...form.natures, [n.code]: 'NA' },
                      })
                    }
                  />{' '}
                  Não aplicável
                </label>
              </div>
            ))}
          </div>
          <div style={{ height: 8 }} />
          <textarea
            className="field"
            rows={3}
            placeholder="Perigos"
            value={form.hazards}
            onChange={(e) => setForm({ ...form, hazards: e.target.value })}
          />
          <div style={{ height: 8 }} />
          <textarea
            className="field"
            rows={3}
            placeholder="Controles"
            value={form.controls}
            onChange={(e) => setForm({ ...form, controls: e.target.value })}
          />
          <div style={{ height: 12 }} />
          <b>Técnicos para aprovação (até 4) + Gestor</b>
          <div style={{ marginTop: 8 }}>
            {technicians.slice(0, 12).map((t) => {
              const id = fieldOf(t, 'id');
              const checked = form.technicianApproverIds.includes(id);
              return (
                <label key={id} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && form.technicianApproverIds.length >= 4}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        technicianApproverIds: checked
                          ? f.technicianApproverIds.filter((x) => x !== id)
                          : [...f.technicianApproverIds, id].slice(0, 4),
                      }))
                    }
                  />
                  {fieldOf(t, 'full_name', 'fullName', 'name')}
                </label>
              );
            })}
          </div>
          <div style={{ height: 8 }} />
          <button className="btn btn-primary">Salvar APR</button>
        </form>
      ) : (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="muted">
            Técnico não cadastra APR. Consulte as APRs existentes e vincule na Nova PT.
          </p>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Título</th>
              <th align="left">Atividade</th>
              <th align="left">Naturezas</th>
              <th align="left">Status</th>
              <th align="left">Aprovar</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhuma APR.
                </td>
              </tr>
            ) : (
              items.map((a) => {
                const content = (a.content as Record<string, unknown>) ?? {};
                const natures = (content.natures as Record<string, string>) ?? {};
                const applicable = Object.entries(natures)
                  .filter(([, v]) => v === 'APPLICABLE')
                  .map(([k]) => ACTIVITY_NATURES.find((n) => n.code === k)?.label ?? k)
                  .join(', ');
                return (
                  <tr key={fieldOf(a, 'id')}>
                    <td>{fieldOf(a, 'title', 'name')}</td>
                    <td>{fieldOf(a, 'activity', 'activity_name')}</td>
                    <td className="muted">{applicable || '—'}</td>
                    <td>
                      <span className="badge">{fieldOf(a, 'status')}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          className="field"
                          placeholder="PIN"
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          style={{ width: 90 }}
                        />
                        {user?.role === 'TECHNICIAN'
                          ? APR_TECH_SLOTS.map((slot) => (
                              <CriticalActionButton
                                key={slot}
                                type="button"
                                onClick={() => void approveSlot(fieldOf(a, 'id'), slot)}
                              >
                                Tec {slot.slice(-1)}
                              </CriticalActionButton>
                            ))
                          : null}
                        {['MANAGER', 'MASTER'].includes(user?.role ?? '') ? (
                          <CriticalActionButton
                            type="button"
                            onClick={() => void approveSlot(fieldOf(a, 'id'), 'MANAGER')}
                          >
                            {roleLabel('MANAGER')}
                          </CriticalActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <Link className="btn btn-ghost" to="/pts/nova">
          Ir para Nova PT
        </Link>
      </div>
    </>
  );
}
