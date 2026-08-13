import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

const PRECAUTIONS = [
  'EPI adequado disponível e em uso',
  'Área isolada / sinalizada',
  'Energia zero / LOTO aplicado',
  'Andaime / plataforma inspecionada',
  'Espaço confinado — permissão específica',
  'Trabalho a quente — extintor próximo',
  'Proteção contra queda instalada',
  'Condições climáticas adequadas',
];

export function PtsPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [team, setTeam] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const isTech = user?.role === 'TECHNICIAN';

  async function load() {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (team) params.set('team', team);
      const qs = params.toString();
      const r = await api<unknown>(`/pts${qs ? `?${qs}` : ''}`, { token });
      setItems(emptyItems<Row>(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar PTs');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function printSelected() {
    if (selected.length === 0) return;
    try {
      await api('/pts/print', {
        method: 'POST',
        token,
        body: JSON.stringify({ ids: selected }),
      });
      window.open(`/api/v1/pts/print?ids=${selected.join(',')}`, '_blank');
    } catch {
      window.print();
    }
  }

  return (
    <>
      <PageHead
        title={isTech ? 'Minhas PTs' : 'Painel operacional de PT'}
        subtitle="Busca, filtros por data/equipe e impressão múltipla."
        actions={
          <>
            {isTech && user?.canEmitPt ? (
              <Link className="btn btn-primary" to="/pts/nova">
                Nova PT
              </Link>
            ) : null}
            <button className="btn btn-ghost" disabled={selected.length === 0} onClick={() => void printSelected()}>
              Imprimir ({selected.length})
            </button>
          </>
        }
      />
      <Err error={error} />

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8 }}>
          <input
            className="field"
            placeholder="Buscar OS, descrição, TAG…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input className="field" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input className="field" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <input
            className="field"
            placeholder="Equipe"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
          <button className="btn btn-primary" type="button" onClick={() => void load()}>
            Filtrar
          </button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th />
              <th align="left">Nº / OS</th>
              <th align="left">Descrição</th>
              <th align="left">Natureza</th>
              <th align="left">Status</th>
              <th align="left">Data</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhuma PT encontrada.
                </td>
              </tr>
            ) : (
              items.map((pt) => {
                const id = fieldOf(pt, 'id');
                return (
                  <tr key={id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(id)}
                        onChange={() => toggle(id)}
                      />
                    </td>
                    <td>
                      <b>{fieldOf(pt, 'number', 'pt_number', 'os')}</b>
                    </td>
                    <td>{fieldOf(pt, 'description', 'title')}</td>
                    <td>{fieldOf(pt, 'nature', 'activity_nature')}</td>
                    <td>
                      <span className="badge">{fieldOf(pt, 'status')}</span>
                    </td>
                    <td>{fieldOf(pt, 'workDate', 'work_date', 'created_at')}</td>
                    <td>
                      <Link className="btn btn-ghost" to={`/pts/${id}`}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PtNewPage() {
  const { token, user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Row[]>([]);
  const [technicians, setTechnicians] = useState<Row[]>([]);
  const [form, setForm] = useState({
    os: '',
    description: '',
    nature: 'ALTURA',
    hazards: '',
    precautions: Object.fromEntries(PRECAUTIONS.map((p) => [p, 'NA' as 'YES' | 'NO' | 'NA'])),
    equipmentTags: [] as string[],
    teamUserIds: [] as string[],
  });

  useEffect(() => {
    void api<unknown>('/equipment', { token })
      .then((r) => setEquipment(emptyItems<Row>(r)))
      .catch(() => setEquipment([]));
    void api<unknown>('/technicians', { token })
      .then((r) => setTechnicians(emptyItems<Row>(r)))
      .catch(() => setTechnicians([]));
  }, [token]);

  if (user?.role !== 'TECHNICIAN') {
    return <Navigate to="/pts" replace />;
  }
  if (!user.canEmitPt) {
    return (
      <>
        <PageHead title="Nova PT" />
        <div className="card">
          <p className="error">Seu perfil não está habilitado para emitir PT nesta Obra.</p>
        </div>
      </>
    );
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      equipmentTags: f.equipmentTags.includes(tag)
        ? f.equipmentTags.filter((t) => t !== tag)
        : [...f.equipmentTags, tag],
    }));
  }

  function toggleTeam(id: string) {
    setForm((f) => ({
      ...f,
      teamUserIds: f.teamUserIds.includes(id)
        ? f.teamUserIds.filter((t) => t !== id)
        : [...f.teamUserIds, id],
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      const created = await api<Row>('/pts', {
        method: 'POST',
        token,
        body: JSON.stringify({
          os: form.os,
          description: form.description,
          nature: form.nature,
          hazards: form.hazards.split('\n').filter(Boolean),
          precautions: form.precautions,
          equipmentTags: form.equipmentTags,
          teamUserIds: form.teamUserIds,
        }),
      });
      const id = fieldOf(created, 'id');
      await api(`/pts/${id}/submit`, { method: 'POST', token }).catch(() => undefined);
      nav(`/pts/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar PT');
    }
  }

  const steps = ['OS e descrição', 'Riscos e precauções', 'Equipamentos e equipe', 'Revisar'];

  return (
    <>
      <PageHead title="Nova Permissão de Trabalho" subtitle={`Etapa ${step + 1}: ${steps[step]}`} />
      <Err error={error} />

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {steps.map((s, i) => (
            <span key={s} className="badge" style={{ opacity: i === step ? 1 : 0.5 }}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        {step === 0 ? (
          <>
            <label className="muted">Ordem de Serviço (OS)</label>
            <input
              className="field"
              required
              value={form.os}
              onChange={(e) => setForm({ ...form, os: e.target.value })}
            />
            <div style={{ height: 8 }} />
            <label className="muted">Descrição do serviço</label>
            <textarea
              className="field"
              rows={4}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div style={{ height: 8 }} />
            <label className="muted">Natureza</label>
            <select
              className="field"
              value={form.nature}
              onChange={(e) => setForm({ ...form, nature: e.target.value })}
            >
              <option value="ALTURA">Trabalho em altura</option>
              <option value="ELETRICA">Elétrica</option>
              <option value="ESPACO_CONFINADO">Espaço confinado</option>
              <option value="QUENTE">Trabalho a quente</option>
              <option value="GERAL">Geral</option>
            </select>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label className="muted">Perigos identificados (um por linha)</label>
            <textarea
              className="field"
              rows={4}
              value={form.hazards}
              onChange={(e) => setForm({ ...form, hazards: e.target.value })}
            />
            <div style={{ height: 12 }} />
            <b>Precauções (Sim / Não / N/A)</b>
            {PRECAUTIONS.map((p) => (
              <div
                key={p}
                style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}
              >
                <span style={{ flex: 1, minWidth: 200 }}>{p}</span>
                {(['YES', 'NO', 'NA'] as const).map((v) => (
                  <label key={v} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={p}
                      checked={form.precautions[p] === v}
                      onChange={() =>
                        setForm({
                          ...form,
                          precautions: { ...form.precautions, [p]: v },
                        })
                      }
                    />
                    {v === 'YES' ? 'Sim' : v === 'NO' ? 'Não' : 'N/A'}
                  </label>
                ))}
              </div>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <b>Equipamentos (TAG)</b>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 16px' }}>
              {equipment.length === 0 ? (
                <span className="muted">Nenhum equipamento cadastrado.</span>
              ) : (
                equipment.map((eq) => {
                  const tag = fieldOf(eq, 'tag', 'equipment_tag');
                  const on = form.equipmentTags.includes(tag);
                  return (
                    <button
                      key={fieldOf(eq, 'id')}
                      type="button"
                      className={on ? 'btn btn-primary' : 'btn btn-ghost'}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  );
                })
              )}
            </div>
            <b>Equipe</b>
            <div style={{ marginTop: 8 }}>
              {technicians.map((t) => {
                const id = fieldOf(t, 'id');
                return (
                  <label key={id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={form.teamUserIds.includes(id)}
                      onChange={() => toggleTeam(id)}
                    />
                    {fieldOf(t, 'full_name', 'fullName', 'name')}
                  </label>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <div>
            <p>
              <b>OS:</b> {form.os}
            </p>
            <p>
              <b>Descrição:</b> {form.description}
            </p>
            <p>
              <b>Natureza:</b> {form.nature}
            </p>
            <p>
              <b>TAGs:</b> {form.equipmentTags.join(', ') || '—'}
            </p>
            <p>
              <b>Equipe:</b> {form.teamUserIds.length} membro(s)
            </p>
            <p className="muted">Ao confirmar, a PT será criada e submetida para aprovação.</p>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Voltar
            </button>
          ) : (
            <Link className="btn btn-ghost" to="/pts">
              Cancelar
            </Link>
          )}
          {step < 3 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              Continuar
            </button>
          ) : (
            <button className="btn btn-primary">Criar e submeter</button>
          )}
        </div>
      </form>
    </>
  );
}

export function PtDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [pt, setPt] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pin, setPin] = useState('');
  const [activeSlot, setActiveSlot] = useState<'TST' | 'SUPERVISOR' | 'MANAGER' | null>(null);

  const role = user?.role ?? '';
  const canApprove = ['TST', 'SUPERVISOR', 'MANAGER'].includes(role);

  const mySlot = useMemo(() => {
    if (role === 'TST') return 'TST' as const;
    if (role === 'SUPERVISOR') return 'SUPERVISOR' as const;
    if (role === 'MANAGER') return 'MANAGER' as const;
    return null;
  }, [role]);

  async function load() {
    if (!id) return;
    try {
      setError(null);
      const r = await api<Row>(`/pts/${id}`, { token });
      setPt(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar PT');
      setPt(null);
    }
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  async function decide(decision: 'APPROVE' | 'REJECT', slot: 'TST' | 'SUPERVISOR' | 'MANAGER') {
    if (decision === 'REJECT' && !rejectReason.trim()) {
      setError('Informe o motivo da reprovação.');
      return;
    }
    try {
      setError(null);
      await api(`/pts/${id}/approvals`, {
        method: 'POST',
        token,
        body: JSON.stringify({ slot, decision, reason: rejectReason || undefined, pin }),
      });
      setMsg(decision === 'APPROVE' ? `Slot ${slot} aprovado` : `Slot ${slot} reprovado`);
      setRejectReason('');
      setActiveSlot(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na aprovação');
    }
  }

  if (!pt && !error) return <p className="muted">Carregando PT…</p>;

  const approvals = Array.isArray(pt?.approvals) ? (pt!.approvals as Row[]) : [];

  return (
    <>
      <PageHead
        title={`PT ${fieldOf(pt ?? {}, 'number', 'pt_number', 'os')}`}
        subtitle={fieldOf(pt ?? {}, 'description', 'title')}
        actions={
          <Link className="btn btn-ghost" to="/pts">
            Voltar
          </Link>
        }
      />
      <Err error={error} />
      <Msg text={msg} />

      <div className="kpis">
        <div className="card kpi">
          <label>Status</label>
          <b style={{ fontSize: 18 }}>{fieldOf(pt ?? {}, 'status')}</b>
        </div>
        <div className="card kpi">
          <label>Natureza</label>
          <b style={{ fontSize: 18 }}>{fieldOf(pt ?? {}, 'nature', 'activity_nature')}</b>
        </div>
        <div className="card kpi">
          <label>OS</label>
          <b style={{ fontSize: 18 }}>{fieldOf(pt ?? {}, 'os', 'work_order')}</b>
        </div>
        <div className="card kpi">
          <label>Emissor</label>
          <b style={{ fontSize: 16 }}>{fieldOf(pt ?? {}, 'issuerName', 'issuer_name', 'created_by')}</b>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Detalhes</h3>
        <p>
          <b>Perigos:</b>{' '}
          {Array.isArray(pt?.hazards) ? (pt!.hazards as string[]).join('; ') : fieldOf(pt ?? {}, 'hazards')}
        </p>
        <p>
          <b>Equipamentos:</b>{' '}
          {Array.isArray(pt?.equipmentTags)
            ? (pt!.equipmentTags as string[]).join(', ')
            : fieldOf(pt ?? {}, 'equipment_tags')}
        </p>
      </div>

      {canApprove ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Painel de aprovação</h3>
          <p className="muted">Cada papel age no próprio slot. Gestor pode atuar nos slots permitidos.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {(['TST', 'SUPERVISOR', 'MANAGER'] as const).map((slot) => {
              const existing = approvals.find(
                (a) => fieldOf(a, 'slot', 'role') === slot || fieldOf(a, 'slot') === slot,
              );
              const canAct =
                mySlot === slot || (role === 'MANAGER' && (slot === 'TST' || slot === 'SUPERVISOR' || slot === 'MANAGER'));
              return (
                <div key={slot} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                  <b>Slot {slot}</b>
                  <div className="muted" style={{ margin: '6px 0' }}>
                    {existing
                      ? `${fieldOf(existing, 'decision', 'status')} — ${fieldOf(existing, 'decidedAt', 'decided_at')}`
                      : 'Pendente'}
                  </div>
                  {canAct && !existing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <CriticalActionButton type="button" onClick={() => void decide('APPROVE', slot)}>
                        Aprovar
                      </CriticalActionButton>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setActiveSlot(slot)}
                      >
                        Reprovar…
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {activeSlot ? (
            <div style={{ marginTop: 12 }}>
              <label className="muted">Motivo da reprovação ({activeSlot})</label>
              <textarea
                className="field"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div style={{ height: 8 }} />
              <input
                className="field"
                placeholder="PIN (se exigido)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                style={{ maxWidth: 200 }}
              />
              <div style={{ height: 8 }} />
              <CriticalActionButton type="button" onClick={() => void decide('REJECT', activeSlot)}>
                Confirmar reprovação
              </CriticalActionButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
