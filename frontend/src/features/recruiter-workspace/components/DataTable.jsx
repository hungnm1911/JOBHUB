import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'

import ScrollFade from './ScrollFade'

// Column-aligned list. With `rowTo` the whole row is clickable; a cell must still
// render a link so keyboard users can reach the same destination.
function DataTable({ label, columns, rows, rowKey, rowTo, className }) {
  const navigate = useNavigate()

  const openRow = (event, row) => {
    if (!event.target.closest('a, button')) navigate(rowTo(row))
  }

  return (
    <ScrollFade aria-label={label} fadeClassName="from-card" role="region" tabIndex={0}>
      <table className={cn('w-full min-w-3xl border-collapse text-left text-sm', className)}>
        <thead className="border-b bg-secondary/70">
          <tr>
            {columns.map((column) => (
              <th
                className={cn('px-4 py-3 text-xs font-semibold whitespace-nowrap text-foreground/80', column.className)}
                key={column.header}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              className={cn(rowTo && 'cursor-pointer transition-colors hover:bg-secondary/60')}
              key={rowKey(row)}
              onClick={rowTo ? (event) => openRow(event, row) : undefined}
            >
              {columns.map((column) => (
                <td className={cn('px-4 py-3 align-middle', column.className)} key={column.header}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollFade>
  )
}

export default DataTable
