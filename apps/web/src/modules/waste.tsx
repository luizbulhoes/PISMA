import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { displayLabel } from '../labels';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

export function WastePage() {
  const { token, user } = useAuth();
  const [lots, setLots] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [catalog, setCatalog] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [lot, setLot] = useState({ catalogId: '', weightKg: '', locationId: '' });
  const [selectedLots, setSelectedLots] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [pin, setPin] = useState('');
  const isManager = ['MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const w = await api<unknown>('/waste', { token });
      setLots(emptyItems<Row>(w));
      const r = await api<unknown>('/waste/removal-requests', { token });
      setRequests(emptyItems<Row>(r));
      const c = await api<unknown>('/waste/catalog', { token });
      setCatalog(emptyItems<Row>(c));
      const l = await api<unknown>('/locations', { token }).catch(() => ({ items: [] }));
      setLocations(emptyItems<Row>(l));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar resíduos');
      setLots([]);
      setRequests([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function createLot(e: FormEvent) {
    e.preventDefault();
    try {
      const cat = catalog.find((x) => fieldOf(x, 'id') === lot.catalogId);
      const loc = locations.find((x) => fieldOf(x, 'id') === lot.locationId);
      await api('/waste', {
        method: 'POST',
        token,
        body: JSON.stringify({
          catalogId: lot.catalogId,
          wasteType: cat ? fieldOf(cat, 'name') : undefined,
          weightKg: Number(lot.weightKg),
          location: loc ? fieldOf(loc, 'name') : '',
        }),
      });
      setMsg('Lote registrado');
      setLot({ catalogId: '', weightKg: '', locationId: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar lote');
    }
  }

  async function requestRemoval(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/waste/removal-requests', {
        method: 'POST',
        token,
        body: JSON.stringify({
          lotIds: selectedLots,
          notes,
        }),
      });
      setMsg('Solicitação de retirada criada');
      setSelectedLots([]);
      setNotes('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na solicitação');
    }
  }

  async function signRequest(id: string) {
    try {
      await api(`/waste/removal-requests/${id}/sign`, {
        method: 'POST',
        token,
        body: JSON.stringify({ pin }),
      });
      setMsg('Solicitação assinada pelo Gestor');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na assinatura');
    }
  }

  return (
    <>
      <PageHead
        title="Gestão de Resíduos"
        subtitle="Tipos e locais pré-cadastrados; lotes e retirada com assinatura do Gestor."
      />
      <Err error={error} />
      <Msg text={msg} />

      <form className="card" onSubmit={createLot} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Novo lote</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <select
            className="field"
            required
            value={lot.catalogId}
            onChange={(e) => setLot({ ...lot, catalogId: e.target.value })}
          >
            <option value="">Tipo de resíduo…</option>
            {catalog.map((c) => (
              <option key={fieldOf(c, 'id')} value={fieldOf(c, 'id')}>
                {fieldOf(c, 'code')} — {fieldOf(c, 'name')}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Peso kg"
            type="number"
            step="0.01"
            required
            value={lot.weightKg}
            onChange={(e) => setLot({ ...lot, weightKg: e.target.value })}
          />
          <select
            className="field"
            required
            value={lot.locationId}
            onChange={(e) => setLot({ ...lot, locationId: e.target.value })}
          >
            <option value="">Local…</option>
            {locations.map((l) => (
              <option key={fieldOf(l, 'id')} value={fieldOf(l, 'id')}>
                {fieldOf(l, 'code')} — {fieldOf(l, 'name')}
              </option>
            ))}
          </select>
        </div>
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">Registrar lote</button>
      </form>

      <div className="card" style={{ marginBottom: 12, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Lotes</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th />
              <th align="left">ID</th>
              <th align="left">Tipo</th>
              <th align="left">Peso</th>
              <th align="left">Local</th>
              <th align="left">Situação</th>
            </tr>
          </thead>
          <tbody>
            {lots.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhum lote.
                </td>
              </tr>
            ) : (
              lots.map((l) => {
                const id = fieldOf(l, 'id');
                return (
                  <tr key={id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedLots.includes(id)}
                        onChange={() =>
                          setSelectedLots((s) =>
                            s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                          )
                        }
                      />
                    </td>
                    <td>
                      <code>{id.slice(0, 8)}</code>
                    </td>
                    <td>{fieldOf(l, 'catalog_name', 'wasteType', 'waste_type', 'type')}</td>
                    <td>{fieldOf(l, 'quantity', 'weightKg', 'weight_kg')} kg</td>
                    <td>{fieldOf(l, 'storage_location', 'location')}</td>
                    <td>
                      <span className="badge">{displayLabel(fieldOf(l, 'status'))}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={requestRemoval} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Solicitar retirada</h3>
        <p className="muted">Selecione os lotes na tabela acima.</p>
        <textarea
          className="field"
          rows={2}
          placeholder="Observações"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div style={{ height: 8 }} />
        <button className="btn btn-primary" disabled={selectedLots.length === 0}>
          Solicitar ({selectedLots.length})
        </button>
      </form>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Solicitações de retirada</h3>
        {requests.length === 0 ? (
          <p className="muted">Nenhuma solicitação.</p>
        ) : (
          requests.map((r) => (
            <div key={fieldOf(r, 'id')} style={{ borderTop: '1px solid #dce8e2', padding: '10px 0' }}>
              <b>Pedido {fieldOf(r, 'id').slice(0, 8)}</b>{' '}
              <span className="badge">{displayLabel(fieldOf(r, 'status'))}</span>
              <div className="muted">{fieldOf(r, 'notes')}</div>
              {isManager && fieldOf(r, 'status') !== 'SIGNED' ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    className="field"
                    placeholder="PIN do Gestor"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    style={{ maxWidth: 140 }}
                  />
                  <CriticalActionButton type="button" onClick={() => void signRequest(fieldOf(r, 'id'))}>
                    Assinar retirada
                  </CriticalActionButton>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}
