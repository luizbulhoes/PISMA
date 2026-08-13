import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ACTIVITY_NATURES, defaultNaturesMap, displayLabel, roleLabel, type NatureFill } from '../labels';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Apr = Record<string, unknown>;

export function AprPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Apr[]>([]);
  const [locations, setLocations] = useState<Apr[]>([]);
  const [technicians, setTechnicians] = useState<Apr[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [managerPin, setManagerPin] = useState('');
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
  const isTechnician = user?.role === 'TECHNICIAN';

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/apr', { token });
      const list = emptyItems<Apr>(r);
      setItems(list);
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

  const selected = useMemo(
    () => items.find((a) => fieldOf(a, 'id') === selectedId) ?? null,
    [items, selectedId],
  );

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

  async function decideApr(aprId: string, decision: 'APPROVED' | 'REJECTED') {
    try {
      const slot = isTechnician ? 'TECHNICIAN_1' : 'MANAGER';
      await api(`/apr/${aprId}/approvals`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          slot,
          decision,
          pin: isTechnician ? undefined : managerPin,
        }),
      });
      setMsg(
        decision === 'APPROVED'
          ? 'APR aprovada com assinatura digital'
          : 'APR reprovada com registro de assinatura',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na decisão da APR');
    }
  }

  async function printApr(aprId: string) {
    const apr = items.find((a) => fieldOf(a, 'id') === aprId);
    if (!apr) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const content = (apr.content as Record<string, unknown>) ?? {};
    const natures = (content.natures as Record<string, string>) ?? {};
    const applicable = Object.entries(natures)
      .filter(([, v]) => v === 'APPLICABLE')
      .map(([k]) => ACTIVITY_NATURES.find((n) => n.code === k)?.label ?? k)
      .join(', ');
    w.document.write(`<!doctype html><html><head><title>APR ${fieldOf(apr, 'title')}</title>
      <style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#0d3b2e}
      h1{margin:0 0 8px}.muted{color:#5a6f67}.box{border:1px solid #dce8e2;padding:12px;border-radius:8px;margin-top:12px}</style>
      </head><body>
      <h1>APR — ${fieldOf(apr, 'title')}</h1>
      <div class="muted">Atividade: ${fieldOf(apr, 'activity')} · Situação: ${displayLabel(fieldOf(apr, 'status'))}</div>
      <div class="box"><b>Naturezas aplicáveis</b><div>${applicable || '—'}</div></div>
      <div class="box"><b>Perigos</b><pre>${JSON.stringify(content.hazards ?? [], null, 2)}</pre></div>
      <div class="box"><b>Controles</b><pre>${JSON.stringify(content.controls ?? [], null, 2)}</pre></div>
      <div class="box"><b>Assinaturas digitais</b><div class="muted">Registradas no sistema com credencial do usuário, data/hora e trilha de auditoria.</div></div>
      <script>window.print()</script></body></html>`);
    w.document.close();
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
          <p className="muted">Itens Aplicável serão automarcados e travados nas PTs vinculadas.</p>
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
          <b>Técnicos convidados a aprovar (até 4)</b>
          <p className="muted">Eles lerão a APR e aprovarão/reprovarão com assinatura digital.</p>
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
            Técnico não cadastra APR. Abra uma APR, leia o conteúdo e aprove ou reprove com sua
            assinatura digital.
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
              <th align="left">Situação</th>
              <th />
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
                      <span className="badge">{displayLabel(fieldOf(a, 'status'))}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setSelectedId(fieldOf(a, 'id'))}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>{fieldOf(selected, 'title')}</h3>
          <p className="muted">
            {fieldOf(selected, 'activity')} · {displayLabel(fieldOf(selected, 'status'))}
          </p>
          <div style={{ marginBottom: 8 }}>
            <b>Perigos</b>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(((selected.content as Record<string, unknown>)?.hazards as unknown) ?? [], null, 2)}
            </pre>
          </div>
          <div style={{ marginBottom: 8 }}>
            <b>Controles</b>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(((selected.content as Record<string, unknown>)?.controls as unknown) ?? [], null, 2)}
            </pre>
          </div>

          {isTechnician ? (
            <div className="signature-box">
              <p style={{ marginTop: 0 }}>
                Após ler a APR, registre sua decisão com a <b>assinatura digital</b> da sua conta
                (sem PIN nesta etapa).
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <CriticalActionButton
                  type="button"
                  onClick={() => void decideApr(fieldOf(selected, 'id'), 'APPROVED')}
                >
                  Aprovar e assinar
                </CriticalActionButton>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void decideApr(fieldOf(selected, 'id'), 'REJECTED')}
                >
                  Reprovar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void printApr(fieldOf(selected, 'id'))}
                >
                  Imprimir APR PDF
                </button>
              </div>
            </div>
          ) : null}

          {['MANAGER', 'MASTER'].includes(user?.role ?? '') ? (
            <div className="signature-box" style={{ marginTop: 12 }}>
              <label className="muted">PIN do Gestor</label>
              <input
                className="field"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                style={{ maxWidth: 160, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <CriticalActionButton
                  type="button"
                  onClick={() => void decideApr(fieldOf(selected, 'id'), 'APPROVED')}
                >
                  Aprovar como {roleLabel('MANAGER')}
                </CriticalActionButton>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void printApr(fieldOf(selected, 'id'))}
                >
                  Imprimir APR PDF
                </button>
              </div>
            </div>
          ) : null}

          {!isTechnician && !['MANAGER', 'MASTER'].includes(user?.role ?? '') ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void printApr(fieldOf(selected, 'id'))}
            >
              Imprimir APR PDF
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="card">
        <Link className="btn btn-ghost" to="/pts/nova">
          Ir para Nova PT
        </Link>
      </div>
    </>
  );
}
