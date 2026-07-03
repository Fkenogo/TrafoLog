import { Inbox } from 'lucide-react';

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty-state">
      <Inbox size={24} />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}
