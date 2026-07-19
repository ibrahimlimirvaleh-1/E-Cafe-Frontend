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
          <div>
            <strong>{row.title}</strong>
            <small>{row.subtitle}</small>
          </div>
          <Badge tone={row.tone}>{row.status}</Badge>
          <span>{row.meta}</span>
          <strong>{row.value}</strong>
          {editable ? (
            <div className="ui-row-actions">
              <Link to={`${baseRoute}/${row.id}`} title="Detallar">
                <ChevronRight size={18} />
              </Link>
              <Link to={`${baseRoute}/${row.id}/edit`} title="Redaktə et">
                <Edit3 size={17} />
              </Link>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  )
}
