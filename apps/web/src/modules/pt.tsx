import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ACTIVITY_NATURES, defaultNaturesMap, displayLabel, roleLabel, type NatureFill } from '../labels';
import {
  GENERAL_PRECAUTIONS,
  NATURE_MODULES,
  emptyNatureAnswers,
  type ChecklistAnswer,
} from '../natureModules';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

function natureLabel(code: string) {
  return ACTIVITY_NATURES.find((n) => n.code === code)?.label ?? code;
}

function blockingNoReason(form: {
  natures: Record<string, NatureFill>;
  natureChecklists: Record<string, Record<string, ChecklistAnswer>>;
  precautions: Record<string, ChecklistAnswer>;
}): string | null {
  for (const n of ACTIVITY_NATURES) {
    if (form.natures[n.code] !== 'APPLICABLE') continue;
    const items = NATURE_MODULES[n.code]?.items ?? [];
    const answers = form.natureChecklists[n.code] ?? {};
    for (const item of items) {
      if (answers[item] === 'NO') {
        return `A PT não pode evoluir enquanto “${item}” estiver marcado como Não.`;
      }
    }
  }
  for (const p of GENERAL_PRECAUTIONS) {
    if (form.precautions[p] === 'NO') {
      return `A PT não pode evoluir enquanto uma precaução obrigatória estiver marcada como Não.`;
    }
  }
  return null;
}

function incompleteChecklistReason(form: {
  natures: Record<string, NatureFill>;
  natureChecklists: Record<string, Record<string, ChecklistAnswer>>;
  precautions: Record<string, ChecklistAnswer>;
  step: number;
}): string | null {
  if (form.step === 1) {
    for (const n of ACTIVITY_NATURES) {
      if (form.natures[n.code] !== 'APPLICABLE') continue;
      const items = NATURE_MODULES[n.code]?.items ?? [];
      const answers = form.natureChecklists[n.code] ?? {};
      for (const item of items) {
        if (!answers[item]) return `Responda todos os itens de ${n.label}.`;
      }
    }
  }
  if (form.step === 2) {
    for (const p of GENERAL_PRECAUTIONS) {
      if (form.precautions[p] !== 'YES') {
        return 'Todas as precauções obrigatórias precisam estar marcadas como Sim.';
      }
    }
  }
  return null;
}

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
    for (const id of selected) {
      window.open(`/pts/${id}?print=1`, '_blank');
    }
  }

  return (
    <>
      <PageHead
        title={isTech ? 'Minhas PTs' : 'Painel operacional de PT'}
        subtitle="Busca, filtros por data/equipe e impressão com APR."
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
              <th align="left">Naturezas</th>
              <th align="left">Situação</th>
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
                      <b>{fieldOf(pt, 'number', 'pt_number', 'os_number', 'os')}</b>
                    </td>
                    <td>{fieldOf(pt, 'description', 'title')}</td>
                    <td className="muted" style={{ maxWidth: 180 }}>
                      {typeof pt.nature === 'object' && pt.nature
                        ? Object.entries(pt.nature as Record<string, string>)
                            .filter(([, v]) => v === 'APPLICABLE')
                            .map(([k]) => natureLabel(k))
                            .join(', ') || '—'
                        : fieldOf(pt, 'nature', 'activity_nature') || '—'}
                    </td>
                    <td>
                      <span className="badge">{displayLabel(fieldOf(pt, 'status'))}</span>
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
  const [locations, setLocations] = useState<Row[]>([]);
  const [aprs, setAprs] = useState<Row[]>([]);
  const [lockedNatures, setLockedNatures] = useState<string[]>([]);
  const [form, setForm] = useState({
    os: '',
    description: '',
    locationId: '',
    aprId: '',
    natures: defaultNaturesMap() as Record<string, NatureFill>,
    natureChecklists: {} as Record<string, Record<string, ChecklistAnswer>>,
    hazards: '',
    precautions: Object.fromEntries(
      GENERAL_PRECAUTIONS.map((p) => [p, '' as ChecklistAnswer]),
    ),
    equipmentTags: [] as string[],
    teamUserIds: [] as string[],
    authorizeSignature: false,
  });
  const [addTechOpen, setAddTechOpen] = useState(false);
  const [addTechId, setAddTechId] = useState('');
  const [removeTechId, setRemoveTechId] = useState<string | null>(null);

  useEffect(() => {
    void api<unknown>('/equipment', { token })
      .then((r) => setEquipment(emptyItems<Row>(r)))
      .catch(() => setEquipment([]));
    void api<unknown>('/work-team', { token })
      .then((r) => setTechnicians(emptyItems<Row>(r)))
      .catch(() => setTechnicians([]));
    void api<unknown>('/locations', { token })
      .then((r) => setLocations(emptyItems<Row>(r)))
      .catch(() => setLocations([]));
    void api<unknown>('/apr', { token })
      .then((r) => setAprs(emptyItems<Row>(r)))
      .catch(() => setAprs([]));
  }, [token]);

  async function onSelectApr(aprId: string) {
    setForm((f) => ({ ...f, aprId }));
    if (!aprId) {
      setLockedNatures([]);
      return;
    }
    const apr = aprs.find((a) => fieldOf(a, 'id') === aprId);
    const content = (apr?.content as Record<string, unknown>) ?? {};
    const aprNatures = (content.natures as Record<string, NatureFill>) ?? {};
    const locked = Object.entries(aprNatures)
      .filter(([, v]) => v === 'APPLICABLE')
      .map(([k]) => k);
    setLockedNatures(locked);
    setForm((f) => {
      const natures = { ...f.natures };
      for (const code of locked) natures[code] = 'APPLICABLE';
      const hazardsFromApr = Array.isArray(content.hazards)
        ? (content.hazards as string[]).join('\n')
        : '';
      return {
        ...f,
        aprId,
        natures,
        hazards: [f.hazards, hazardsFromApr].filter(Boolean).join('\n'),
      };
    });
  }

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

  function setNature(code: string, fill: NatureFill) {
    if (lockedNatures.includes(code) && fill !== 'APPLICABLE') return;
    setForm((f) => {
      const natureChecklists = { ...f.natureChecklists };
      if (fill === 'APPLICABLE') {
        natureChecklists[code] = natureChecklists[code] ?? emptyNatureAnswers(code);
      } else {
        delete natureChecklists[code];
      }
      return {
        ...f,
        natures: { ...f.natures, [code]: fill },
        natureChecklists,
      };
    });
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
    if (!form.authorizeSignature) {
      setError('Autorize a assinatura digital para emitir a PT.');
      return;
    }
    const noReason = blockingNoReason(form);
    if (noReason) {
      setError(noReason);
      return;
    }
    try {
      setError(null);
      const created = await api<Row>('/pts', {
        method: 'POST',
        token,
        body: JSON.stringify({
          os: form.os,
          description: form.description,
          locationId: form.locationId || undefined,
          aprId: form.aprId || undefined,
          natures: form.natures,
          natureChecklists: form.natureChecklists,
          hazards: form.hazards.split('\n').filter(Boolean),
          precautions: form.precautions,
          equipmentTags: form.equipmentTags,
          teamUserIds: form.teamUserIds,
          authorizeSignature: true,
        }),
      });
      const id = fieldOf(created, 'id');
      if (form.aprId) {
        await api(`/pts/${id}/apr`, {
          method: 'POST',
          token,
          body: JSON.stringify({ aprId: form.aprId }),
        }).catch(() => undefined);
      }
      await api(`/pts/${id}/submit`, { method: 'POST', token });
      nav(`/pts/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar PT');
    }
  }

  const steps = [
    'APR, local e OS',
    'Naturezas',
    'Riscos e precauções',
    'Técnicos envolvidos e assinatura',
    'Revisar',
  ];
  const applicable = ACTIVITY_NATURES.filter((n) => form.natures[n.code] === 'APPLICABLE');

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
            <label className="muted">Local de trabalho</label>
            <select
              className="field"
              required
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
            >
              <option value="">Selecione o local…</option>
              {locations.map((l) => (
                <option key={fieldOf(l, 'id')} value={fieldOf(l, 'id')}>
                  {fieldOf(l, 'code')} — {fieldOf(l, 'name')}
                </option>
              ))}
            </select>
            <div style={{ height: 8 }} />
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
            <label className="muted">Vincular APR existente (opcional)</label>
            <select
              className="field"
              value={form.aprId}
              onChange={(e) => void onSelectApr(e.target.value)}
            >
              <option value="">Não vincular APR agora</option>
              {aprs.map((a) => (
                <option key={fieldOf(a, 'id')} value={fieldOf(a, 'id')}>
                  {fieldOf(a, 'title', 'name')} — {displayLabel(fieldOf(a, 'status'))}
                </option>
              ))}
            </select>
            <p className="muted" style={{ marginTop: 6 }}>
              Se vincular, as naturezas aplicáveis da APR são automarcadas e não alteráveis.
            </p>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="nature-grid">
              {ACTIVITY_NATURES.map((n) => {
                const locked = lockedNatures.includes(n.code);
                const fill = form.natures[n.code];
                const mod = NATURE_MODULES[n.code];
                return (
                  <div key={n.code} className={`nature-row${locked ? ' locked' : ''}`} style={{ display: 'block' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }}>
                      <div>
                        <b>{n.label}</b>
                        {locked ? (
                          <div className="muted">Definido pela APR — não alterável</div>
                        ) : null}
                      </div>
                      <label>
                        <input
                          type="radio"
                          name={`nat-${n.code}`}
                          checked={fill === 'APPLICABLE'}
                          disabled={locked}
                          onChange={() => setNature(n.code, 'APPLICABLE')}
                        />{' '}
                        Aplicável
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`nat-${n.code}`}
                          checked={fill === 'NA'}
                          disabled={locked}
                          onChange={() => setNature(n.code, 'NA')}
                        />{' '}
                        Não aplicável
                      </label>
                    </div>
                    {fill === 'APPLICABLE' && mod ? (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #dce8e2' }}>
                        <b className="muted">Precauções — {mod.label}</b>
                        {mod.items.map((item) => (
                          <div
                            key={item}
                            style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}
                          >
                            <span style={{ flex: 1, minWidth: 220 }}>{item}</span>
                            {(['YES', 'NO', 'NA'] as const).map((v) => (
                              <label key={v} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input
                                  type="radio"
                                  name={`${n.code}-${item}`}
                                  checked={(form.natureChecklists[n.code]?.[item] ?? '') === v}
                                  onChange={() => {
                                    const next = {
                                      ...form,
                                      natureChecklists: {
                                        ...form.natureChecklists,
                                        [n.code]: {
                                          ...(form.natureChecklists[n.code] ?? emptyNatureAnswers(n.code)),
                                          [item]: v,
                                        },
                                      },
                                    };
                                    setForm(next);
                                    setError(blockingNoReason(next));
                                  }}
                                />
                                {v === 'YES' ? 'Sim' : v === 'NO' ? 'Não' : 'N/A'}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <label className="muted">Perigos identificados</label>
            <textarea
              className="field"
              rows={4}
              value={form.hazards}
              onChange={(e) => setForm({ ...form, hazards: e.target.value })}
            />
            <div style={{ height: 12 }} />
            <b>Precauções obrigatórias para qualquer natureza</b>
            <p className="muted">Somente Sim ou Não. Qualquer Não impede a emissão da PT.</p>
            {GENERAL_PRECAUTIONS.map((p) => (
              <div
                key={p}
                style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}
              >
                <span style={{ flex: 1, minWidth: 200 }}>{p}</span>
                {(['YES', 'NO'] as const).map((v) => (
                  <label key={v} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={p}
                      checked={form.precautions[p] === v}
                      onChange={() => {
                        const next = {
                          ...form,
                          precautions: { ...form.precautions, [p]: v },
                        };
                        setForm(next);
                        setError(blockingNoReason(next));
                      }}
                    />
                    {v === 'YES' ? 'Sim' : 'Não'}
                  </label>
                ))}
              </div>
            ))}
            <div style={{ height: 12 }} />
            <b>Equipamentos (TAG)</b>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
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
          </>
        ) : null}

        {step === 3 ? (
          <>
            <b>Técnicos envolvidos</b>
            <p className="muted">
              Os técnicos envolvidos recebem a PT, visualizam sem alterar, fazem check-in e
              assinam a participação.
            </p>
            <div style={{ marginTop: 10 }}>
              {form.teamUserIds.length === 0 ? (
                <p className="muted">Nenhum técnico envolvido além do emissor.</p>
              ) : (
                technicians
                  .filter((t) => form.teamUserIds.includes(fieldOf(t, 'id')))
                  .map((t) => {
                    const id = fieldOf(t, 'id');
                    return (
                      <div
                        key={id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: '1px solid #dce8e2',
                        }}
                      >
                        <span>
                          {fieldOf(t, 'full_name', 'fullName', 'name')}
                          {fieldOf(t, 'role') !== '—' ? ` — ${roleLabel(fieldOf(t, 'role'))}` : ''}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setRemoveTechId(id)}
                        >
                          Remover técnico da atividade
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const first = technicians.find(
                    (t) =>
                      fieldOf(t, 'id') !== user.id && !form.teamUserIds.includes(fieldOf(t, 'id')),
                  );
                  setAddTechId(first ? fieldOf(first, 'id') : '');
                  setAddTechOpen(true);
                }}
              >
                Novo técnico envolvido na atividade
              </button>
            </div>
            <div className="signature-box" style={{ marginTop: 16 }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={form.authorizeSignature}
                  onChange={(e) => setForm({ ...form, authorizeSignature: e.target.checked })}
                />
                <span>
                  <b>Autorizo a assinatura digital desta PT</b>
                  <div className="muted">
                    Confirmo a emissão deste documento com a minha assinatura digital já vinculada
                    à minha conta.
                  </div>
                </span>
              </label>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <div>
            <p>
              <b>OS:</b> {form.os}
            </p>
            <p>
              <b>Descrição:</b> {form.description}
            </p>
            <p>
              <b>APR:</b>{' '}
              {form.aprId
                ? fieldOf(aprs.find((a) => fieldOf(a, 'id') === form.aprId) ?? {}, 'title', 'name') ||
                  form.aprId
                : '—'}
            </p>
            <p>
              <b>Naturezas aplicáveis:</b>{' '}
              {applicable.map((n) => n.label).join(', ') || 'nenhuma'}
            </p>
            <p>
              <b>Técnicos envolvidos:</b>{' '}
              {form.teamUserIds.length === 0
                ? 'nenhum'
                : technicians
                    .filter((t) => form.teamUserIds.includes(fieldOf(t, 'id')))
                    .map((t) => fieldOf(t, 'full_name', 'fullName', 'name'))
                    .join(', ')}
            </p>
            <p>
              <b>Assinatura do emissor autorizada:</b> {form.authorizeSignature ? 'Sim' : 'Não'}
            </p>
            <div className="signature-box" style={{ marginTop: 12 }}>
              <b>Observação</b>
              <p className="muted" style={{ marginBottom: 0 }}>
                Ao criar e submeter, a PT seguirá para análise e aprovação. TST e
                Supervisor/Gestor assinarão na aprovação. Os técnicos envolvidos farão check-in e
                assinarão a participação após a autorização.
              </p>
            </div>
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
          {step < 4 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(blockingNoReason(form))}
              onClick={() => {
                const noReason = blockingNoReason(form);
                if (noReason) {
                  setError(noReason);
                  return;
                }
                const incomplete = incompleteChecklistReason({ ...form, step });
                if (incomplete) {
                  setError(incomplete);
                  return;
                }
                if (step === 0 && (!form.locationId || !form.os.trim() || !form.description.trim())) {
                  setError('Preencha local, OS e descrição do serviço.');
                  return;
                }
                setError(null);
                setStep((s) => s + 1);
              }}
            >
              Continuar
            </button>
          ) : (
            <button className="btn btn-primary" disabled={Boolean(blockingNoReason(form))}>
              Criar e submeter
            </button>
          )}
        </div>
      </form>

      {addTechOpen ? (
        <div className="modal-backdrop" onClick={() => setAddTechOpen(false)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Novo técnico envolvido na atividade</h3>
            <p className="muted">Selecione outro técnico ou o supervisor da Obra. O emissor desta PT não aparece na lista.</p>
            <select
              className="field"
              value={addTechId}
              onChange={(e) => setAddTechId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {technicians
                .filter(
                  (t) =>
                    fieldOf(t, 'id') !== user.id && !form.teamUserIds.includes(fieldOf(t, 'id')),
                )
                .map((t) => (
                  <option key={fieldOf(t, 'id')} value={fieldOf(t, 'id')}>
                    {fieldOf(t, 'full_name', 'fullName', 'name')}
                    {fieldOf(t, 'role') !== '—' ? ` — ${roleLabel(fieldOf(t, 'role'))}` : ''}
                  </option>
                ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setAddTechOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!addTechId}
                onClick={() => {
                  toggleTeam(addTechId);
                  setAddTechOpen(false);
                  setAddTechId('');
                }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {removeTechId ? (
        <div className="modal-backdrop" onClick={() => setRemoveTechId(null)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Remover técnico da atividade</h3>
            <p>
              Remover{' '}
              <b>
                {fieldOf(
                  technicians.find((t) => fieldOf(t, 'id') === removeTechId) ?? {},
                  'full_name',
                  'fullName',
                  'name',
                )}
              </b>{' '}
              da PT?
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setRemoveTechId(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  toggleTeam(removeTechId);
                  setRemoveTechId(null);
                }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PtDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [pt, setPt] = useState<Row | null>(null);
  const [bundle, setBundle] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pin, setPin] = useState('');
  const [activeSlot, setActiveSlot] = useState<'TST' | 'SUPERVISOR' | null>(null);
  const [checkinPin, setCheckinPin] = useState('');

  const role = user?.role ?? '';
  const canApprove = ['TST', 'SUPERVISOR', 'MANAGER'].includes(role);

  const mySlot = useMemo(() => {
    if (role === 'TST') return 'TST' as const;
    if (role === 'SUPERVISOR') return 'SUPERVISOR' as const;
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('print') === '1' && id) {
      void api<Row>(`/pts/${id}/print-bundle`, { token })
        .then((b) => {
          setBundle(b);
          setTimeout(() => window.print(), 400);
        })
        .catch(() => undefined);
    }
  }, [id, token]);

  async function decide(decision: 'APPROVED' | 'REJECTED', slot: 'TST' | 'SUPERVISOR') {
    if (decision === 'REJECTED' && !rejectReason.trim()) {
      setError('Informe o motivo da reprovação.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('Informe o PIN de assinatura com 6 dígitos.');
      return;
    }
    try {
      setError(null);
      await api(`/pts/${id}/approvals`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          slot,
          decision,
          reason: rejectReason || undefined,
          pin,
          expectedVersionId: pt?.current_version_id,
        }),
      });
      setMsg(decision === 'APPROVED' ? `Slot ${roleLabel(slot)} aprovado com assinatura` : `Slot ${roleLabel(slot)} reprovado`);
      setRejectReason('');
      setActiveSlot(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na aprovação');
    }
  }

  async function doCheckin() {
    try {
      await api(`/pts/${id}/checkin`, {
        method: 'POST',
        token,
        body: JSON.stringify({ pin: checkinPin }),
      });
      setMsg('Check-in realizado com assinatura digital');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no check-in');
    }
  }

  async function printBundle() {
    try {
      const b = await api<Row>(`/pts/${id}/print-bundle`, { token });
      setBundle(b);
      setTimeout(() => window.print(), 300);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PT ainda não autorizada para impressão');
    }
  }

  if (!pt && !error) return <p className="muted">Carregando PT…</p>;

  const approvals = Array.isArray(pt?.approvals) ? (pt!.approvals as Row[]) : [];
  const checkins = Array.isArray(pt?.checkins) ? (pt!.checkins as Row[]) : [];
  const issuerSignature =
    pt?.issuerSignature && typeof pt.issuerSignature === 'object'
      ? (pt.issuerSignature as Row)
      : null;
  const natures = (pt?.natures as Record<string, string>) ?? {};
  const answers = (pt?.answers as Record<string, unknown>) ?? {};
  const hasSignatures = Boolean(issuerSignature) || approvals.length > 0 || checkins.length > 0;

  return (
    <>
      <PageHead
        title={`PT ${fieldOf(pt ?? {}, 'number', 'pt_number', 'os_number', 'os')}`}
        subtitle={String(answers.description ?? fieldOf(pt ?? {}, 'description', 'title'))}
        actions={
          <>
            <button className="btn btn-primary" type="button" onClick={() => void printBundle()}>
              Imprimir PT + APR
            </button>
            <Link className="btn btn-ghost" to="/pts">
              Voltar
            </Link>
          </>
        }
      />
      <Err error={error} />
      <Msg text={msg} />

      <div className="kpis">
        <div className="card kpi">
          <label>Situação</label>
          <b style={{ fontSize: 18 }}>{displayLabel(fieldOf(pt ?? {}, 'status'))}</b>
        </div>
        <div className="card kpi">
          <label>OS</label>
          <b style={{ fontSize: 18 }}>{fieldOf(pt ?? {}, 'os', 'os_number')}</b>
        </div>
        <div className="card kpi">
          <label>Emissor</label>
          <b style={{ fontSize: 16 }}>{fieldOf(pt ?? {}, 'issuerName', 'issuer_name', 'created_by')}</b>
        </div>
        <div className="card kpi">
          <label>Check-ins</label>
          <b style={{ fontSize: 18 }}>{checkins.length}</b>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Naturezas</h3>
        <div className="nature-grid">
          {ACTIVITY_NATURES.map((n) => (
            <div key={n.code} className="nature-row">
              <b>{n.label}</b>
              <span className="badge">
                {natures[n.code] === 'APPLICABLE' ? 'Aplicável' : 'Não aplicável'}
              </span>
              {(answers.naturesLockedFromApr as string[] | undefined)?.includes(n.code) ? (
                <span className="muted">APR</span>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Assinaturas digitais</h3>
        {!hasSignatures ? (
          <p className="muted">Ainda sem assinaturas formais.</p>
        ) : (
          <>
            {issuerSignature ? (
              <div className="signature-box" style={{ marginBottom: 8 }}>
                <b>{roleLabel('ISSUER')}</b> — {fieldOf(issuerSignature, 'signer_name')} ·{' '}
                {displayLabel(fieldOf(issuerSignature, 'decision'))} ·{' '}
                {fieldOf(issuerSignature, 'signed_at')}
                <div className="muted">Assinatura do técnico emissor. Aguardando TST e Supervisor.</div>
              </div>
            ) : null}
            {approvals.map((a) => (
              <div key={fieldOf(a, 'id')} className="signature-box" style={{ marginBottom: 8 }}>
                <b>{roleLabel(fieldOf(a, 'slot'))}</b> — {fieldOf(a, 'signer_name')} ·{' '}
                {displayLabel(fieldOf(a, 'decision'))} · {fieldOf(a, 'signed_at')}
                <div className="muted">Hash: {String(fieldOf(a, 'document_hash')).slice(0, 16)}…</div>
              </div>
            ))}
            {checkins.map((c) => (
              <div key={fieldOf(c, 'id')} className="signature-box" style={{ marginBottom: 8 }}>
                <b>Check-in Técnico</b> — {fieldOf(c, 'full_name')} · {fieldOf(c, 'checked_in_at')}
              </div>
            ))}
          </>
        )}
      </div>

      {role === 'TECHNICIAN' && ['APPROVED', 'IN_EXECUTION'].includes(fieldOf(pt ?? {}, 'status')) ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Check-in na atividade</h3>
          <p className="muted">Confirma participação e gera assinatura digital no documento.</p>
          <div style={{ display: 'flex', gap: 8, maxWidth: 360 }}>
            <input
              className="field"
              placeholder="PIN de assinatura"
              value={checkinPin}
              onChange={(e) => setCheckinPin(e.target.value)}
            />
            <CriticalActionButton type="button" onClick={() => void doCheckin()}>
              Check-in
            </CriticalActionButton>
          </div>
        </div>
      ) : null}

      {canApprove ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Painel de aprovação</h3>
          <p className="muted">
            Cada papel age no próprio slot com PIN. Gestor pode atuar nos slots TST e Supervisor.
          </p>
          <div style={{ marginBottom: 8, maxWidth: 200 }}>
            <label className="muted">PIN de assinatura</label>
            <input className="field" value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(['TST', 'SUPERVISOR'] as const).map((slot) => {
              const existing = approvals.find(
                (a) => fieldOf(a, 'slot', 'role') === slot || fieldOf(a, 'slot') === slot,
              );
              const canAct =
                mySlot === slot || role === 'MANAGER';
              return (
                <div key={slot} style={{ border: '1px solid #dce8e2', borderRadius: 10, padding: 12 }}>
                  <b>Slot {roleLabel(slot)}</b>
                  <div className="muted" style={{ margin: '6px 0' }}>
                    {existing
                      ? `${displayLabel(fieldOf(existing, 'decision', 'status'))} — ${fieldOf(existing, 'signer_name')} — ${fieldOf(existing, 'signed_at', 'decided_at')}`
                      : 'Pendente'}
                  </div>
                  {canAct && !existing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <CriticalActionButton type="button" onClick={() => void decide('APPROVED', slot)}>
                        Aprovar e assinar
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
              <label className="muted">Motivo da reprovação ({roleLabel(activeSlot)})</label>
              <textarea
                className="field"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div style={{ height: 8 }} />
              <CriticalActionButton type="button" onClick={() => void decide('REJECTED', activeSlot)}>
                Confirmar reprovação
              </CriticalActionButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {bundle ? (
        <div className="card" id="print-area">
          <h2>Documento impresso — PT + APR</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(bundle, null, 2)}
          </pre>
        </div>
      ) : null}
    </>
  );
}
