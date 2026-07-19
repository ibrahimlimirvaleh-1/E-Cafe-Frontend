import { ChevronRight, Edit3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AdminRow } from '../../entities/types'
import { Badge } from './Badge'

type DataTableProps = {
  columns: string[]
  rows: AdminRow[]
  baseRoute: string
  editable?: boolean
}

export function DataTable({ baseRoute, columns, editable = true, rows }: DataTableProps) {
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
            <div className="ui-row-actions" data-label="Əməliyyat">
              <Link className="ui-action-link" to={`${baseRoute}/${row.id}`} title="Detallar">
                <ChevronRight size={18} />
                <span>Detallar</span>
              </Link>
              <Link className="ui-action-link" to={`${baseRoute}/${row.id}/edit`} title="Redaktə et">
                <Edit3 size={17} />
                <span>Redaktə</span>
              </Link>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  )
}
