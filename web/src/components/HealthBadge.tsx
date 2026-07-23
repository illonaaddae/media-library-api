import { useEffect, useState } from 'react';
import { api } from '../api';

export default function HealthBadge() {
  const [state, setState] = useState<{ up: boolean; uptime: number } | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const h = await api.health();
        if (active) setState({ up: h.status === 'ok', uptime: h.uptime });
      } catch {
        if (active) setState({ up: false, uptime: 0 });
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const cls = state ? (state.up ? 'dot ok' : 'dot down') : 'dot';
  const label = !state
    ? 'checking…'
    : state.up
      ? `API healthy · up ${Math.floor(state.uptime)}s`
      : 'API unreachable';

  return (
    <div className="health">
      <span className={cls} />
      <span>{label}</span>
    </div>
  );
}
