import { Loader2 } from 'lucide-react';

export function Loading({ label = 'Loading', variant = 'inline' }: { label?: string; variant?: 'inline' | 'auth' }) {
  if (variant === 'auth') {
    return (
      <div className="auth-loading-screen" role="status" aria-live="polite">
        <div className="auth-loading-card">
          <div className="brand-mark">kV</div>
          <Loader2 className="spin" size={22} />
          <span>{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Loader2 className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
