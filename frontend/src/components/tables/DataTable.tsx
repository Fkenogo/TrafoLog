import { ReactNode } from 'react';
import { EmptyState } from '../common/EmptyState';

interface DataTableProps<T> {
  columns: string[];
  rows: T[];
  emptyTitle: string;
  emptyMessage: string;
  renderRow: (row: T, index: number) => ReactNode;
}

export function DataTable<T>({ columns, rows, emptyTitle, emptyMessage, renderRow }: DataTableProps<T>) {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (safeRows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{safeRows.map((row, index) => renderRow(row, index))}</tbody>
      </table>
    </div>
  );
}
