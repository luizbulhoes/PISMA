import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ACTIVITY_NATURES, defaultNaturesMap, displayLabel, roleLabel, type NatureFill } from '../labels';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Apr = Record<string, unknown>;

function listFromContent(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap((v) => listFromContent(v));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        return listFromContent(JSON.parse(trimmed));
      } catch {
        /* texto comum */
      }
    }
    return trimmed
      .split(/\r?\n|,/)
      .map((s) => s.replace(/^["'\s]+|["'\s]+$/g, ''))
      .filter(Boolean);
  }
  return [];
}

function applicableNatureLabels(content: Record<string, unknown>): string[] {
  const natures = (content.natures as Record<string, string>) ?? {};
  return Object.entries(natures)
    .filter(([, v]) => v === 'APPLICABLE')
    .map(([k]) => ACTIVITY_NATURES.find((n) => n.code === k)?.label ?? k);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function approvalsOf(apr: Apr): Apr[] {
  return Array.isArray(apr.approvals) ? (apr.approvals as Apr[]) : [];
}

function AprItems({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="apr-panel">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Nenhum item informado.
        </p>
      ) : (
        <ul className="apr-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const selectedContent = ((selected?.content as Record<string, unknown>) ?? {});
  const selectedNatures = applicableNatureLabels(selectedContent);
  const selectedLocation =
    fieldOf(selectedContent, 'area') !== '—'
      ? fieldOf(selectedContent, 'area')
      : fieldOf(selected ?? {}, 'area', 'location');
  const selectedApprovals = selected ? approvalsOf(selected) : [];
  const alreadySigned = selectedApprovals.some(
    (a) => fieldOf(a, 'signer_user_id') === (user?.id ?? ''),
  );
  const designatedIds = Array.isArray(selectedContent.technicianApproverIds)
    ? (selectedContent.technicianApproverIds as string[])
    : [];
  const statusClosed = ['APPROVED', 'REJECTED'].includes(fieldOf(selected ?? {}, 'status'));

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
      setError(null);
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
          ? 'Assinatura digital registrada nesta APR'
          : 'APR reprovada com registro de assinatura',
      );
      await load();
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Falha na decisão da APR';
      try {
        const parsed = JSON.parse(message) as { message?: string | string[] };
        if (typeof parsed.message === 'string') message = parsed.message;
        else if (Array.isArray(parsed.message)) message = parsed.message.join(' ');
      } catch {
        /* texto simples */
      }
      setError(message);
    }
  }

  async function printApr(aprId: string) {
    const apr = items.find((a) => fieldOf(a, 'id') === aprId);
    if (!apr) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const content = (apr.content as Record<string, unknown>) ?? {};
    const applicable = applicableNatureLabels(content).join(', ');
    const hazards = listFromContent(content.hazards);
    const controls = listFromContent(content.controls);
    const author = fieldOf(apr, 'author_name');
    const signatures = approvalsOf(apr);
    const listHtml = (rows: string[]) =>
      rows.length === 0
        ? '<p class="muted">Nenhum item informado.</p>'
        : `<ul>${rows.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
    const signaturesHtml =
      signatures.length === 0
        ? '<p>Não há assinaturas registradas nesta APR.</p>'
        : `<ul>${signatures
            .map((s) => {
              const who = escapeHtml(fieldOf(s, 'signer_name'));
              const slot = escapeHtml(roleLabel(fieldOf(s, 'slot')));
              const decision = escapeHtml(displayLabel(fieldOf(s, 'decision')));
              const when = escapeHtml(fieldOf(s, 'signed_at'));
              return `<li><b>${who}</b> — ${slot} · ${decision} · ${when}</li>`;
            })
            .join('')}</ul>`;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><title>APR ${escapeHtml(fieldOf(apr, 'title'))}</title>
      <style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#0d3b2e;max-width:720px;margin:0 auto}
      h1{margin:0 0 8px}.muted{color:#5a6f67}.box{border:1px solid #dce8e2;padding:14px 16px;border-radius:10px;margin-top:12px}
      ul{margin:8px 0 0;padding-left:18px} li{margin:6px 0}</style>
      </head><body>
      <h1>APR — ${escapeHtml(fieldOf(apr, 'title'))}</h1>
      <div class="muted">Atividade: ${escapeHtml(fieldOf(apr, 'activity'))} · Situação: ${escapeHtml(displayLabel(fieldOf(apr, 'status')))}</div>
      <div class="box"><b>Elaborado por</b><div>${escapeHtml(author)}</div></div>
      <div class="box"><b>Naturezas aplicáveis</b><div>${escapeHtml(applicable || '—')}</div></div>
      <div class="box"><b>Perigos</b>${listHtml(hazards)}</div>
      <div class="box"><b>Controles</b>${listHtml(controls)}</div>
      <div class="box"><b>Assinaturas digitais</b>${signaturesHtml}</div>
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
        <div className="card apr-detail" style={{ marginBottom: 12 }}>
          <div className="apr-detail-head">
            <div>
              <h3 style={{ margin: '0 0 6px' }}>{fieldOf(selected, 'title')}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {fieldOf(selected, 'activity')}
                {fieldOf(selected, 'area') !== '—' ? ` · ${fieldOf(selected, 'area')}` : ''}
              </p>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Elaborado por <b style={{ color: 'inherit' }}>{fieldOf(selected, 'author_name')}</b>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge">{displayLabel(fieldOf(selected, 'status'))}</span>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedId(null)}>
                Fechar
              </button>
            </div>
          </div>

          {selectedLocation !== '—' ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Local analisado: <b style={{ color: 'inherit' }}>{selectedLocation}</b>
            </p>
          ) : null}
          <div className="apr-natures">
            <span className="muted">Naturezas aplicáveis</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {selectedNatures.length === 0 ? (
                <span className="muted">Nenhuma natureza aplicável.</span>
              ) : (
                selectedNatures.map((n) => (
                  <span key={n} className="badge">
                    {n}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="apr-detail-grid">
            <AprItems title="Perigos identificados" items={listFromContent(selectedContent.hazards)} />
            <AprItems title="Controles" items={listFromContent(selectedContent.controls)} />
          </div>

          <div className="apr-panel" style={{ marginBottom: 16 }}>
            <h4>Assinaturas digitais</h4>
            {selectedApprovals.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Não há assinaturas registradas nesta APR.
              </p>
            ) : (
              <ul className="apr-list">
                {selectedApprovals.map((s) => (
                  <li key={fieldOf(s, 'id', 'slot')}>
                    <b>{fieldOf(s, 'signer_name')}</b> — {roleLabel(fieldOf(s, 'slot'))} ·{' '}
                    {displayLabel(fieldOf(s, 'decision'))} · {fieldOf(s, 'signed_at')}
                  </li>
                ))}
              </ul>
            )}
            {designatedIds.length > 0 ? (
              <p className="muted" style={{ margin: '10px 0 0' }}>
                Técnicos convidados:{' '}
                {designatedIds
                  .map((id) => {
                    const signed = selectedApprovals.some((s) => fieldOf(s, 'signer_user_id') === id);
                    const name =
                      fieldOf(
                        technicians.find((t) => fieldOf(t, 'id') === id) ?? {},
                        'full_name',
                        'fullName',
                        'name',
                      ) || id.slice(0, 8);
                    return `${name}${signed ? ' (assinou)' : ' (pendente)'}`;
                  })
                  .join(' · ')}
              </p>
            ) : null}
          </div>

          {isTechnician && !alreadySigned && !statusClosed ? (
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
              </div>
            </div>
          ) : null}

          {isTechnician && alreadySigned ? (
            <p className="muted">Sua assinatura digital já está nesta APR.</p>
          ) : null}

          {['MANAGER', 'MASTER'].includes(user?.role ?? '') && !alreadySigned && !statusClosed ? (
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
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 12 }}>
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

      <div className="card">
        <Link className="btn btn-ghost" to="/pts/nova">
          Ir para Nova PT
        </Link>
      </div>
    </>
  );
}
