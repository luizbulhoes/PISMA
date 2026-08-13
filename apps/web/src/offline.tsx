import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

/** Tracks browser online/offline status (Wave 7). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      Você está offline. Consultas locais podem funcionar; assinaturas e aprovações ficam bloqueadas até
      reconectar.
    </div>
  );
}

type GateProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** When true, requires online connectivity (sign/approve). */
  requiresOnline?: boolean;
};

/** Primary action that blocks sign/approve when offline. */
export function CriticalActionButton({
  children,
  requiresOnline = true,
  disabled,
  title,
  ...rest
}: GateProps) {
  const online = useOnline();
  const blocked = requiresOnline && !online;
  return (
    <button
      {...rest}
      className={rest.className ?? 'btn btn-primary'}
      disabled={disabled || blocked}
      title={blocked ? 'Reconecte à rede para assinar ou aprovar.' : title}
    >
      {blocked ? 'Offline — ação bloqueada' : children}
    </button>
  );
}
