import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';

type TechListItem = {
  id: string;
  full_name: string;
  employee_number: string | null;
  job_function: string | null;
  aso: { label: string; tone: string; validUntil: string | null };
  trainings: { valid: number; expiring: number; expired: number; total: number };
  lastPpe: { deliveredAt: string; itemCount: number } | null;
  blocked: boolean;
};

export function TechniciansPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<TechListItem[]>([]);

  useEffect(() => {
    void api<{ items: TechListItem[] }>('/technicians', { token }).then((r) => setItems(r.items));
  }, [token]);

  return (
    <>
      <h1>Técnicos</h1>
      <p className="muted">Gestão de ficha, ASO, treinamentos e EPI por Obra.</p>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Técnico</th>
              <th align="left">Matrícula</th>
              <th align="left">Função</th>
              <th align="left">ASO</th>
              <th align="left">Treinamentos</th>
              <th align="left">Último EPI</th>
              <th align="left">Bloqueio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.full_name}</td>
                <td>{t.employee_number ?? '-'}</td>
                <td>{t.job_function ?? '-'}</td>
                <td>
                  <span className="badge">{t.aso.label}</span>
                </td>
                <td>
                  {t.trainings.valid} válidos / {t.trainings.expiring} vencem / {t.trainings.expired}{' '}
                  vencidos
                </td>
                <td>{t.lastPpe ? t.lastPpe.deliveredAt : '—'}</td>
                <td>{t.blocked ? 'Bloqueado' : 'Livre'}</td>
                <td>
                  <Link className="btn btn-ghost" to={`/tecnicos/${t.id}`}>
                    Abrir ficha
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TechnicianDetailPage({ self = false }: { self?: boolean }) {
  const { id } = useParams();
  const { token, user } = useAuth();
  const techId = self ? user!.id : id!;
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const canManage = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');
  const isManager = ['MANAGER', 'MASTER'].includes(user?.role ?? '');

  const [training, setTraining] = useState({
    trainingName: 'NR-35 Trabalho em Altura',
    completedAt: new Date().toISOString().slice(0, 10),
    validityValue: 12,
    validityUnit: 'MONTHS' as const,
  });
  const [aso, setAso] = useState({
    asoDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });
  const [ppe, setPpe] = useState({
    description: 'Botina de segurança',
    caNumber: '45678',
    sizeValue: '42',
    quantity: 1,
    reason: 'EXCHANGE',
  });
  const [block, setBlock] = useState({ scope: 'EMIT_PT', reason: '' });
  const [pin, setPin] = useState('');
  const [evalResult, setEvalResult] = useState<any>(null);

  async function reload() {
    const path = self ? '/me/technician-profile' : `/technicians/${techId}`;
    const r = await api(path, { token });
    setData(r);
  }

  useEffect(() => {
    void reload();
  }, [token, techId, self]);

  if (!data) return <p className="muted">Carregando ficha…</p>;

  async function onTraining(e: FormEvent) {
    e.preventDefault();
    await api('/trainings', {
      method: 'POST',
      token,
      body: JSON.stringify({ technicianUserId: techId, ...training }),
    });
    setMsg('Treinamento registrado');
    await reload();
  }

  async function onAso(e: FormEvent) {
    e.preventDefault();
    await api('/aso', {
      method: 'POST',
      token,
      body: JSON.stringify({ technicianUserId: techId, ...aso }),
    });
    setMsg('ASO atualizado');
    await reload();
  }

  async function onPpe(e: FormEvent) {
    e.preventDefault();
    await api('/ppe-deliveries', {
      method: 'POST',
      token,
      body: JSON.stringify({
        technicianUserId: techId,
        deliveredAt: new Date().toISOString().slice(0, 10),
        reason: ppe.reason,
        items: [
          {
            description: ppe.description,
            caNumber: ppe.caNumber,
            sizeValue: ppe.sizeValue,
            quantity: ppe.quantity,
          },
        ],
      }),
    });
    setMsg('Entrega de EPI criada — termo pendente de assinatura do Técnico');
    await reload();
  }

  async function onBlock(e: FormEvent) {
    e.preventDefault();
    await api('/blocks', {
      method: 'POST',
      token,
      body: JSON.stringify({ userId: techId, scope: block.scope, reason: block.reason }),
    });
    setMsg('Bloqueio aplicado');
    await reload();
  }

  async function onPdf() {
    const pdf = await api<{ file: { id: string } }>(`/technicians/${techId}/pdf`, {
      method: 'POST',
      token,
    });
    setMsg(`PDF gerado: arquivo ${pdf.file.id}`);
  }

  async function onEvaluate() {
    const r = await api('/competency/evaluate', {
      method: 'POST',
      token,
      body: JSON.stringify({
        technicianUserId: techId,
        activityNature: 'ALTURA',
        jobFunction: data.profile.job_function,
      }),
    });
    setEvalResult(r);
  }

  async function signPending() {
    const pending = (data.ppeDeliveries as any[]).find((d) => d.term_status === 'PENDING_SIGNATURE');
    if (!pending) return;
    await api(`/ppe-deliveries/${pending.id}/sign`, {
      method: 'POST',
      token,
      body: JSON.stringify({ pin }),
    });
    setMsg('Termo de EPI assinado');
    await reload();
  }

  return (
    <>
      <h1>{self ? 'Minha Ficha' : data.profile.full_name}</h1>
      <p className="muted">
        {data.profile.job_function} • Matrícula {data.profile.employee_number ?? '—'} •{' '}
        {data.work?.name}
      </p>
      {msg ? <div className="card" style={{ marginBottom: 12 }}>{msg}</div> : null}

      <div className="kpis">
        <div className="card kpi">
          <label>ASO</label>
          <b style={{ fontSize: 16 }}>
            {data.asos.find((a: any) => a.status === 'ACTIVE')?.toneLabel ?? 'Não informado'}
          </b>
        </div>
        <div className="card kpi">
          <label>Treinamentos</label>
          <b style={{ fontSize: 16 }}>{data.trainings.filter((t: any) => t.status === 'ACTIVE').length}</b>
        </div>
        <div className="card kpi">
          <label>EPI</label>
          <b style={{ fontSize: 16 }}>{data.ppeDeliveries.length} entregas</b>
        </div>
        <div className="card kpi">
          <label>Assinatura</label>
          <b style={{ fontSize: 16 }}>{data.profile.signature_status ?? '—'}</b>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => void onPdf()}>
          Gerar ficha em PDF
        </button>
        <button className="btn btn-ghost" onClick={() => void onEvaluate()}>
          Avaliar competência (Altura)
        </button>
      </div>

      {evalResult ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <b>{evalResult.ready ? 'Pronto para PT' : 'Bloqueado por regra'}</b>
          <ul>
            {evalResult.findings.map((f: any) => (
              <li key={f.ruleId}>
                {f.ok ? '✓' : '✗'} {f.ruleName}: {f.detail}
                {f.blocking && !f.ok ? ' (bloqueante)' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Treinamentos</h3>
        {data.trainings.map((t: any) => (
          <div key={t.id} style={{ marginBottom: 8 }}>
            <b>{t.training_name}</b> — {t.toneLabel} {t.valid_until ? `até ${t.valid_until}` : ''}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>ASO</h3>
        {data.asos.map((a: any) => (
          <div key={a.id}>
            {a.aso_date} → {a.valid_until} • {a.toneLabel}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>EPI / Termos</h3>
        {data.ppeDeliveries.map((d: any) => (
          <div key={d.id} style={{ marginBottom: 8 }}>
            {d.delivered_at} • {d.reason} • termo {d.term_status}
          </div>
        ))}
        {self && data.ppeDeliveries.some((d: any) => d.term_status === 'PENDING_SIGNATURE') ? (
          <div style={{ marginTop: 8 }}>
            <input
              className="field"
              placeholder="PIN para assinar termo"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{ maxWidth: 220, display: 'inline-block', marginRight: 8 }}
            />
            <button className="btn btn-primary" onClick={() => void signPending()}>
              Assinar termo pendente
            </button>
          </div>
        ) : null}
      </div>

      {canManage && !self ? (
        <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <form className="card" onSubmit={onTraining}>
            <h3>Registrar treinamento</h3>
            <input className="field" value={training.trainingName} onChange={(e) => setTraining({ ...training, trainingName: e.target.value })} />
            <div style={{ height: 8 }} />
            <input className="field" type="date" value={training.completedAt} onChange={(e) => setTraining({ ...training, completedAt: e.target.value })} />
            <div style={{ height: 8 }} />
            <button className="btn btn-primary">Salvar</button>
          </form>
          <form className="card" onSubmit={onAso}>
            <h3>Atualizar ASO</h3>
            <input className="field" type="date" value={aso.asoDate} onChange={(e) => setAso({ ...aso, asoDate: e.target.value })} />
            <div style={{ height: 8 }} />
            <input className="field" type="date" value={aso.validUntil} onChange={(e) => setAso({ ...aso, validUntil: e.target.value })} />
            <div style={{ height: 8 }} />
            <button className="btn btn-primary">Salvar</button>
          </form>
          <form className="card" onSubmit={onPpe}>
            <h3>Entrega / troca de EPI</h3>
            <input className="field" value={ppe.description} onChange={(e) => setPpe({ ...ppe, description: e.target.value })} />
            <div style={{ height: 8 }} />
            <input className="field" placeholder="CA" value={ppe.caNumber} onChange={(e) => setPpe({ ...ppe, caNumber: e.target.value })} />
            <div style={{ height: 8 }} />
            <input className="field" placeholder="Tamanho" value={ppe.sizeValue} onChange={(e) => setPpe({ ...ppe, sizeValue: e.target.value })} />
            <div style={{ height: 8 }} />
            <button className="btn btn-primary">Gerar termo</button>
          </form>
          {isManager ? (
            <form className="card" onSubmit={onBlock}>
              <h3>Bloquear usuário</h3>
              <select className="field" value={block.scope} onChange={(e) => setBlock({ ...block, scope: e.target.value })}>
                <option value="EMIT_PT">EMIT_PT</option>
                <option value="SIGN">SIGN</option>
                <option value="ALL_OPERATIONAL">ALL_OPERATIONAL</option>
              </select>
              <div style={{ height: 8 }} />
              <input className="field" placeholder="Motivo obrigatório" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
              <div style={{ height: 8 }} />
              <button className="btn btn-primary">Aplicar bloqueio</button>
            </form>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function CompetencyPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    jobFunction: '',
    activityNature: 'ALTURA',
    requirementType: 'TRAINING',
    requirementKey: 'NR-35',
    blocking: true,
  });

  useEffect(() => {
    void api<{ items: any[] }>('/competency-rules', { token }).then((r) => setItems(r.items));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api('/competency-rules', { method: 'POST', token, body: JSON.stringify(form) });
    const r = await api<{ items: any[] }>('/competency-rules', { token });
    setItems(r.items);
  }

  return (
    <>
      <h1>Matriz de Competência</h1>
      <p className="muted">Regras corporativas bloqueantes só quando marcadas explicitamente.</p>
      <form className="card" onSubmit={onSubmit} style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="field" placeholder="Nome da regra" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="Função" value={form.jobFunction} onChange={(e) => setForm({ ...form, jobFunction: e.target.value })} />
          <input className="field" placeholder="Atividade" value={form.activityNature} onChange={(e) => setForm({ ...form, activityNature: e.target.value })} />
          <input className="field" placeholder="Chave requisito" value={form.requirementKey} onChange={(e) => setForm({ ...form, requirementKey: e.target.value })} />
        </div>
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">+ Regra</button>
      </form>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Nome</th>
              <th align="left">Tipo</th>
              <th align="left">Chave</th>
              <th align="left">Bloqueante</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.requirement_type}</td>
                <td>{r.requirement_key}</td>
                <td>{r.blocking ? 'Sim' : 'Não'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function UsersAdminPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    username: '',
    temporaryPassword: 'ChangeMe!123',
    fullName: '',
    role: 'TECHNICIAN',
    jobFunction: '',
    workId: '',
  });

  useEffect(() => {
    void (async () => {
      const users = await api<{ items: any[] }>('/users', { token });
      setItems(users.items);
      const works = await api<{ items: Array<{ id: string }> }>('/works', { token });
      if (works.items[0]) setForm((f) => ({ ...f, workId: works.items[0]!.id }));
    })();
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api('/users', { method: 'POST', token, body: JSON.stringify(form) });
    const users = await api<{ items: any[] }>('/users', { token });
    setItems(users.items);
  }

  return (
    <>
      <h1>Usuários</h1>
      <form className="card" onSubmit={onSubmit} style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input className="field" placeholder="Usuário" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="field" placeholder="Nome" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="field" placeholder="Função" value={form.jobFunction} onChange={(e) => setForm({ ...form, jobFunction: e.target.value })} />
          <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="TECHNICIAN">TECHNICIAN</option>
            <option value="TST">TST</option>
            <option value="SUPERVISOR">SUPERVISOR</option>
            <option value="MANAGER">MANAGER</option>
            <option value="MASTER">MASTER</option>
          </select>
        </div>
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">Criar usuário (primeiro acesso pendente)</button>
      </form>
      <div className="card">
        {items.map((u) => (
          <div key={u.id} style={{ marginBottom: 6 }}>
            <b>{u.full_name ?? u.username}</b> — {u.role} — {u.status}
          </div>
        ))}
      </div>
    </>
  );
}
