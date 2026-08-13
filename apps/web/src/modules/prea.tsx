import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

export function PreaPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    location: '',
    description: '',
    wasteTypes: '',
    weightsKg: '',
    photoDuring: '',
    photoAfter: '',
    photoDeposit: '',
  });
  const [pin, setPin] = useState('');
  const canApprove = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/prea', { token });
      setItems(emptyItems<Row>(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar PREA');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      const types = form.wasteTypes.split(',').map((s) => s.trim()).filter(Boolean);
      const weights = form.weightsKg.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
      await api('/prea', {
        method: 'POST',
        token,
        body: JSON.stringify({
          title: form.title,
          location: form.location,
          description: form.description,
          waste: types.map((type, i) => ({ type, weightKg: weights[i] ?? 0 })),
          photos: {
            during: form.photoDuring || undefined,
            after: form.photoAfter || undefined,
            deposit: form.photoDeposit || undefined,
          },
        }),
      });
      setMsg('PREA aberta');
      setForm({
        title: '',
        location: '',
        description: '',
        wasteTypes: '',
        weightsKg: '',
        photoDuring: '',
        photoAfter: '',
        photoDeposit: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir PREA');
    }
  }

  async function approve(id: string, slot: 'TST' | 'MANAGER') {
    try {
      await api(`/prea/${id}/approvals`, {
        method: 'POST',
        token,
        body: JSON.stringify({ slot, decision: 'APPROVE', pin }),
      });
      setMsg(`Aprovação ${slot} registrada`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na aprovação');
    }
  }

  return (
    <>
      <PageHead
        title="PREA — Emergências ambientais"
        subtitle="Fotos durante/após/depósito, resíduos e dupla aprovação TST + Gestor."
      />
      <Err error={error} />
      <Msg text={msg} />

      <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Abrir PREA</h3>
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
            placeholder="Local"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <input
            className="field"
            placeholder="Tipos de resíduo (vírgula)"
            value={form.wasteTypes}
            onChange={(e) => setForm({ ...form, wasteTypes: e.target.value })}
          />
          <input
            className="field"
            placeholder="Pesos kg (vírgula, mesma ordem)"
            value={form.weightsKg}
            onChange={(e) => setForm({ ...form, weightsKg: e.target.value })}
          />
          <input
            className="field"
            placeholder="Foto durante (fileId)"
            value={form.photoDuring}
            onChange={(e) => setForm({ ...form, photoDuring: e.target.value })}
          />
          <input
            className="field"
            placeholder="Foto após (fileId)"
            value={form.photoAfter}
            onChange={(e) => setForm({ ...form, photoAfter: e.target.value })}
          />
          <input
            className="field"
            placeholder="Foto depósito (fileId)"
            value={form.photoDeposit}
            onChange={(e) => setForm({ ...form, photoDeposit: e.target.value })}
          />
        </div>
        <div style={{ height: 8 }} />
        <textarea
          className="field"
          rows={3}
          required
          placeholder="Descrição da ocorrência ambiental"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">Abrir PREA</button>
      </form>

      <div className="card">
        {items.length === 0 ? (
          <p className="muted">Nenhuma PREA.</p>
        ) : (
          items.map((p) => {
            const id = fieldOf(p, 'id');
            return (
              <div key={id} style={{ borderTop: '1px solid #e5e7eb', padding: '12px 0' }}>
                <b>{fieldOf(p, 'title')}</b> <span className="badge">{fieldOf(p, 'status')}</span>
                <div className="muted">{fieldOf(p, 'location')}</div>
                <div>{fieldOf(p, 'description')}</div>
                {canApprove ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      className="field"
                      placeholder="PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      style={{ maxWidth: 120 }}
                    />
                    {(user?.role === 'TST' || user?.role === 'MANAGER' || user?.role === 'MASTER') && (
                      <CriticalActionButton type="button" onClick={() => void approve(id, 'TST')}>
                        Aprovar TST
                      </CriticalActionButton>
                    )}
                    {(user?.role === 'MANAGER' || user?.role === 'MASTER') && (
                      <CriticalActionButton type="button" onClick={() => void approve(id, 'MANAGER')}>
                        Aprovar Gestor
                      </CriticalActionButton>
                    )}
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
