import { Loader2 } from 'lucide-react';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Loader2 className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
