import { ChevronRight, Edit3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AdminRow } from '../../entities/types'
import { Badge } from './Badge'

type DataTableProps = {
  baseRoute: string
  columns: string[]
  editable?: boolean
  emptyMessage?: string
  rows: AdminRow[]
}

// Shared admin table keeps list pages responsive and makes action placement consistent.
export function DataTable({ baseRoute, columns, editable = true, emptyMessage = 'Melumat tapilmadi.', rows }: DataTableProps) {
  return (
    <section className="ui-table" aria-label="Melumat cedveli">
      <div className="ui-table-head">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
        {editable ? <span>Emeliyyat</span> : null}
      </div>
      {rows.map((row) => (
        <article className="ui-table-row" key={row.id}>
          <div className="ui-table-primary" data-label={columns[0]}>
            {row.image ? <img className="ui-table-thumb" src={row.image} alt={row.title} /> : null}
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
            <div className="ui-row-actions" data-label="Emeliyyat">
              <Link className="ui-action-link" to={`${baseRoute}/${row.id}`} title="Detallar">
                <ChevronRight size={18} />
                <span>Detallar</span>
              </Link>
              <Link className="ui-action-link" to={`${baseRoute}/${row.id}/edit`} title="Redakte et">
                <Edit3 size={17} />
                <span>Redakte</span>
              </Link>
            </div>
          ) : null}
        </article>
      ))}
      {rows.length === 0 ? <p className="ui-table-empty">{emptyMessage}</p> : null}
    </section>
  )
}
