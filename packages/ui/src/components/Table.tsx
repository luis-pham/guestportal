import type { ReactNode } from 'react';

export type TableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
};

export type TableProps<T> = {
  columns: Array<TableColumn<T>>;
  rows: T[];
  getRowId: (row: T) => string;
  caption?: string;
  empty?: ReactNode;
};

export function Table<T>({ columns, rows, getRowId, caption, empty }: TableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="gp-table-wrap">
      <table className="gp-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              {columns.map((column) => (
                <td key={column.id}>{column.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
