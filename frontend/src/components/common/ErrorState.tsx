import { AlertTriangle } from 'lucide-react';
import { getApiErrorMessage } from '../../api/http';

export function ErrorState({ error, title = 'Unable to load data' }: { error: unknown; title?: string }) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={22} />
      <strong>{title}</strong>
      <span>{getApiErrorMessage(error)}</span>
    </div>
  );
}
