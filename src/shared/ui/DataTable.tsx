import { Eye, Pencil } from 'lucide-react'
import type { AdminRow } from '../../entities/types'
import { ActionIconLink } from './ActionIconButton'
import { Badge } from './Badge'
import { EmptyState } from './EmptyState'
import { SafeImage } from './SafeImage'

type DataTableProps = {
  baseRoute: string
  columns: string[]
  editable?: boolean
  emptyMessage?: string
  rows: AdminRow[]
}

export function DataTable({ baseRoute, columns, editable = true, emptyMessage = 'Məlumat tapılmadı.', rows }: DataTableProps) {
  return (
    <section className="ui-table" aria-label="Məlumat cədvəli">
      <div className="ui-table-head">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
        {editable ? <span>Əməliyyat</span> : null}
      </div>
      {rows.map((row) => (
        <article className="ui-table-row" key={row.id}>
          <div className="ui-table-primary" data-label={columns[0]}>
            {row.image ? <SafeImage className="ui-table-thumb" src={row.image} alt={row.title} /> : null}
            <span>
              <strong>{row.title}</strong>
              <small>{row.subtitle}</small>
            </span>
          </div>
          <div className="ui-table-cell" data-label={columns[1]}>
            <Badge tone={row.tone}>{row.status}</Badge>
          </div>
          <span className="ui-table-cell" data-label={columns[2]}>
            {row.meta}
          </span>
          <strong className="ui-table-cell" data-label={columns[3]}>
            {row.value}
          </strong>
          {editable ? (
            <div className="ui-row-actions" data-label="Əməliyyat">
              <ActionIconLink label={`${row.title} detalına bax`} to={`${baseRoute}/${row.id}`}>
                <Eye size={18} />
              </ActionIconLink>
              {row.canEdit === false ? null : (
                <ActionIconLink label={`${row.title} redaktə et`} to={`${baseRoute}/${row.id}/edit`}>
                  <Pencil size={17} />
                </ActionIconLink>
              )}
            </div>
          ) : null}
        </article>
      ))}
      {rows.length === 0 ? <EmptyState title="Məlumat yoxdur" message={emptyMessage} /> : null}
    </section>
  )
}
