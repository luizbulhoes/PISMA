import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

type PhotoSlot = { fileId: string; description: string; preview?: string };

async function uploadImage(token: string | null, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/v1/files/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as { id: string };
  return json.id;
}

export function PreaPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Row[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    locationId: '',
    description: '',
    wasteCatalogId: '',
    weightKg: '',
  });
  const [photos, setPhotos] = useState<{
    during: PhotoSlot;
    after: PhotoSlot;
    deposit: PhotoSlot;
  }>({
    during: { fileId: '', description: '' },
    after: { fileId: '', description: '' },
    deposit: { fileId: '', description: '' },
  });
  const [pin, setPin] = useState('');
  const canApprove = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/prea', { token });
      setItems(emptyItems<Row>(r));
      const l = await api<unknown>('/locations', { token }).catch(() => ({ items: [] }));
      setLocations(emptyItems<Row>(l));
      const w = await api<unknown>('/waste/catalog', { token }).catch(() => ({ items: [] }));
      setWasteTypes(emptyItems<Row>(w));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar emergências ambientais');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onPhoto(
    slot: 'during' | 'after' | 'deposit',
    file: File | null,
  ) {
    if (!file) return;
    try {
      const fileId = await uploadImage(token, file);
      setPhotos((p) => ({
        ...p,
        [slot]: {
          ...p[slot],
          fileId,
          preview: URL.createObjectURL(file),
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload da imagem');
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      const loc = locations.find((x) => fieldOf(x, 'id') === form.locationId);
      const waste = wasteTypes.find((x) => fieldOf(x, 'id') === form.wasteCatalogId);
      await api('/prea', {
        method: 'POST',
        token,
        body: JSON.stringify({
          title: form.title,
          location: loc ? fieldOf(loc, 'name') : form.locationId,
          locationId: form.locationId,
          description: form.description,
          waste: waste
            ? [{ type: fieldOf(waste, 'name'), catalogId: fieldOf(waste, 'id'), weightKg: Number(form.weightKg || 0) }]
            : [],
          photos: {
            during: photos.during.fileId
              ? { fileId: photos.during.fileId, description: photos.during.description }
              : undefined,
            after: photos.after.fileId
              ? { fileId: photos.after.fileId, description: photos.after.description }
              : undefined,
            deposit: photos.deposit.fileId
              ? { fileId: photos.deposit.fileId, description: photos.deposit.description }
              : undefined,
          },
        }),
      });
      setMsg('PREA aberta dentro de Emergências Ambientais');
      setForm({ title: '', locationId: '', description: '', wasteCatalogId: '', weightKg: '' });
      setPhotos({
        during: { fileId: '', description: '' },
        after: { fileId: '', description: '' },
        deposit: { fileId: '', description: '' },
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
      setMsg(`Aprovação ${slot === 'TST' ? 'TST' : 'Gestor'} registrada`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na aprovação');
    }
  }

  function photoField(
    slot: 'during' | 'after' | 'deposit',
    label: string,
  ) {
    const p = photos[slot];
    return (
      <div style={{ border: '1px solid #dce8e2', borderRadius: 10, padding: 10 }}>
        <b>{label}</b>
        <div style={{ height: 8 }} />
        <input
          className="field"
          type="file"
          accept="image/*"
          onChange={(e) => void onPhoto(slot, e.target.files?.[0] ?? null)}
        />
        {p.preview ? (
          <img src={p.preview} alt={label} style={{ marginTop: 8, maxWidth: '100%', borderRadius: 8 }} />
        ) : null}
        <div style={{ height: 8 }} />
        <input
          className="field"
          placeholder="Descrição da imagem"
          value={p.description}
          onChange={(e) =>
            setPhotos((prev) => ({
              ...prev,
              [slot]: { ...prev[slot], description: e.target.value },
            }))
          }
        />
      </div>
    );
  }

  return (
    <>
      <PageHead
        title="Emergências Ambientais"
        subtitle="Nesta tela você constrói o PREA — Plano de Resposta a Emergência Ambiental."
      />
      <Err error={error} />
      <Msg text={msg} />

      <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Abrir PREA</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          O PREA registra a ocorrência ambiental, evidências fotográficas, tipos de resíduo e
          exige dupla aprovação (TST + Gestor) para formalizar a resposta.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            className="field"
            placeholder="Título"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="field"
            required
            value={form.locationId}
            onChange={(e) => setForm({ ...form, locationId: e.target.value })}
          >
            <option value="">Local…</option>
            {locations.map((l) => (
              <option key={fieldOf(l, 'id')} value={fieldOf(l, 'id')}>
                {fieldOf(l, 'code')} — {fieldOf(l, 'name')}
              </option>
            ))}
          </select>
          <select
            className="field"
            required
            value={form.wasteCatalogId}
            onChange={(e) => setForm({ ...form, wasteCatalogId: e.target.value })}
          >
            <option value="">Tipo de resíduo…</option>
            {wasteTypes.map((w) => (
              <option key={fieldOf(w, 'id')} value={fieldOf(w, 'id')}>
                {fieldOf(w, 'code')} — {fieldOf(w, 'name')}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Peso kg"
            type="number"
            step="0.01"
            value={form.weightKg}
            onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
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
        <div style={{ height: 12 }} />
        <b>Fotos</b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          {photoField('during', 'Durante')}
          {photoField('after', 'Após')}
          {photoField('deposit', 'Depósito')}
        </div>
        <div style={{ height: 12 }} />
        <button className="btn btn-primary">Abrir PREA</button>
      </form>

      <div className="card">
        {items.length === 0 ? (
          <p className="muted">Nenhuma emergência ambiental / PREA.</p>
        ) : (
          items.map((p) => {
            const id = fieldOf(p, 'id');
            return (
              <div key={id} style={{ borderTop: '1px solid #dce8e2', padding: '12px 0' }}>
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
