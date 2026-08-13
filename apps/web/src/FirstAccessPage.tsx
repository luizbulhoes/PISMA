import { FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';
import { PROFILE_FIELD_LABELS } from './labels';

const PRIVACY_VERSION = 'PISMA-PRIVACY-1.3';

export function FirstAccessPage() {
  const { token, user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const [pwd, setPwd] = useState({ currentPassword: 'ChangeMe!123', newPassword: '', confirm: '' });
  const [profile, setProfile] = useState({
    fullName: user?.fullName ?? '',
    cpf: '',
    birthYear: 1990,
    employeeNumber: '',
    jobFunction: 'Técnico Mecânico',
    employer: 'Empresa Demo PISMA',
  });
  const [pin, setPin] = useState({ pin: '', confirmPin: '' });
  const [photos, setPhotos] = useState<{
    selfie: File | null;
    badge_front: File | null;
    badge_back: File | null;
  }>({ selfie: null, badge_front: null, badge_back: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0d3b2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      drawing.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => {
      drawing.current = false;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
    };
  }, [step]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.firstLoginCompleted) return <Navigate to="/" replace />;

  async function uploadPhoto(kind: 'selfie' | 'badge_front' | 'badge_back', file: File) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const res = await fetch('/api/v1/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { id: string };
    await api(`/first-access/photo/${kind}`, {
      method: 'POST',
      token,
      body: JSON.stringify({ fileId: json.id }),
    });
  }

  async function next(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (step === 1) {
        if (pwd.newPassword !== pwd.confirm) throw new Error('Confirmação de senha diferente');
        await api('/first-access/password', {
          method: 'POST',
          token,
          body: JSON.stringify({
            currentPassword: pwd.currentPassword,
            newPassword: pwd.newPassword,
          }),
        });
      }
      if (step === 2) {
        await api('/first-access/profile', {
          method: 'POST',
          token,
          body: JSON.stringify({ ...profile, cpf: profile.cpf.replace(/\D/g, '') }),
        });
      }
      if (step === 3) {
        await api('/first-access/privacy', {
          method: 'POST',
          token,
          body: JSON.stringify({ privacyNoticeVersion: PRIVACY_VERSION, accepted: true }),
        });
      }
      if (step === 4) {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas ausente');
        const pngBase64 = canvas.toDataURL('image/png');
        await api('/first-access/signature-visual', {
          method: 'POST',
          token,
          body: JSON.stringify({ pngBase64 }),
        });
      }
      if (step === 5) {
        await api('/first-access/signature-pin', {
          method: 'POST',
          token,
          body: JSON.stringify(pin),
        });
      }
      if (step === 6) {
        if (!photos.selfie || !photos.badge_front || !photos.badge_back) {
          throw new Error('Envie selfie e crachá frente/verso');
        }
        await uploadPhoto('selfie', photos.selfie);
        await uploadPhoto('badge_front', photos.badge_front);
        await uploadPhoto('badge_back', photos.badge_back);
        await api('/first-access/complete', { method: 'POST', token });
        await refreshUser();
        return;
      }
      setStep((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na ativação da conta');
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={next} style={{ width: 'min(560px, 100%)' }}>
        <h1 style={{ marginTop: 0 }}>Ativação de conta</h1>
        <p className="muted">
          Etapa {step} de 6 — obrigatório para qualquer usuário obter acesso e assinatura digital.
          Sem concluir, o sistema permanece bloqueado.
        </p>

        {step === 1 && (
          <>
            <label className="muted">Senha temporária</label>
            <input className="field" type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
            <div style={{ height: 8 }} />
            <label className="muted">Nova senha</label>
            <input className="field" type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
            <div style={{ height: 8 }} />
            <label className="muted">Confirmar</label>
            <input className="field" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
          </>
        )}

        {step === 2 && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Informe seus dados cadastrais. O CPF é obrigatório e integra a identidade da
              assinatura digital.
            </p>
            {(['fullName', 'cpf', 'employeeNumber', 'jobFunction', 'employer'] as const).map((k) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <label className="muted">{PROFILE_FIELD_LABELS[k]}</label>
                <input
                  className="field"
                  value={String(profile[k])}
                  onChange={(e) => setProfile({ ...profile, [k]: e.target.value })}
                  required={k === 'cpf' || k === 'fullName'}
                  inputMode={k === 'cpf' ? 'numeric' : undefined}
                  placeholder={k === 'cpf' ? 'Somente números' : undefined}
                />
              </div>
            ))}
            <label className="muted">{PROFILE_FIELD_LABELS.birthYear}</label>
            <input
              className="field"
              type="number"
              value={profile.birthYear}
              onChange={(e) => setProfile({ ...profile, birthYear: Number(e.target.value) })}
            />
          </>
        )}

        {step === 3 && (
          <div className="muted">
            <p>
              A PISMA coleta dados cadastrais, selfie, crachá e assinatura eletrônica interna para
              controle de segurança na Obra. Selfie não ativa reconhecimento facial automático.
            </p>
            <p>Versão do aviso: {PRIVACY_VERSION}</p>
            <p>Ao continuar, você declara ciência e concordância.</p>
          </div>
        )}

        {step === 4 && (
          <>
            <p className="muted">Desenhe sua assinatura visual — ela aparece nos documentos assinados.</p>
            <canvas
              ref={canvasRef}
              width={480}
              height={180}
              style={{ width: '100%', border: '1px solid #b7cfc4', borderRadius: 8, touchAction: 'none', background: '#fff' }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 8 }}
              onClick={() => {
                const c = canvasRef.current;
                const ctx = c?.getContext('2d');
                if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
              }}
            >
              Limpar
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <label className="muted">PIN de assinatura (6 dígitos)</label>
            <input className="field" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value })} />
            <div style={{ height: 8 }} />
            <label className="muted">Confirmar PIN</label>
            <input className="field" value={pin.confirmPin} onChange={(e) => setPin({ ...pin, confirmPin: e.target.value })} />
          </>
        )}

        {step === 6 && (
          <>
            <p>
              Para concluir o registro inicial e ativar a assinatura digital, envie:
            </p>
            <ul className="muted" style={{ marginTop: 8 }}>
              <li>Selfie do titular da conta</li>
              <li>CPF (já informado na etapa de dados)</li>
              <li>Foto da frente do crachá</li>
              <li>Foto do verso do crachá</li>
            </ul>
            <label className="muted">Selfie</label>
            <input
              className="field"
              type="file"
              accept="image/*"
              capture="user"
              required
              onChange={(e) => setPhotos({ ...photos, selfie: e.target.files?.[0] ?? null })}
            />
            <div style={{ height: 8 }} />
            <label className="muted">Foto frente do crachá</label>
            <input
              className="field"
              type="file"
              accept="image/*"
              required
              onChange={(e) => setPhotos({ ...photos, badge_front: e.target.files?.[0] ?? null })}
            />
            <div style={{ height: 8 }} />
            <label className="muted">Foto verso do crachá</label>
            <input
              className="field"
              type="file"
              accept="image/*"
              required
              onChange={(e) => setPhotos({ ...photos, badge_back: e.target.files?.[0] ?? null })}
            />
          </>
        )}

        {error ? <div className="error">{error}</div> : null}
        <div style={{ height: 12 }} />
        <button className="btn btn-primary" style={{ width: '100%' }}>
          {step === 6 ? 'Concluir cadastro' : 'Continuar'}
        </button>
      </form>
    </div>
  );
}
