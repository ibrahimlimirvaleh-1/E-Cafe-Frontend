type DonutPart = { label: string; value: number; formatted: string; color: string }

type Props = {
  title: string
  total: number
  totalLabel: string
  totalFormatted: string
  parts: DonutPart[]
  emptyLabel: string
  note: string
}

export function DashboardDonut({ title, total, totalLabel, totalFormatted, parts, emptyLabel, note }: Props) {
  const sum = parts.reduce((value, part) => value + part.value, 0)
  if (!Number.isFinite(total) || total < 0 || parts.some((part) => !Number.isFinite(part.value) || part.value < 0) || Math.abs(sum - total) > Number.EPSILON * Math.max(1, total) * parts.length * 4) return null

  let position = 0
  const segments = parts.filter((part) => part.value > 0).map((part, index, activeParts) => {
    const start = position
    position = index === activeParts.length - 1 ? 100 : position + part.value / total * 100
    return `${part.color} ${start}% ${position}%`
  })

  return <figure className="role-dashboard-donut">
    <figcaption>{title}</figcaption>
    {total > 0 ? <div className="role-dashboard-donut-content">
      <div className="role-dashboard-donut-ring" style={{ background: `conic-gradient(${segments.join(', ')})` }}
        role="img" aria-label={`${title}: ${parts.map((part) => `${part.label} ${part.formatted}`).join(', ')}`}>
        <div className="role-dashboard-donut-center"><strong>{totalFormatted}</strong><span>{totalLabel}</span></div>
      </div>
      <ul>{parts.map((part) => <li key={part.label}>
        <i style={{ background: part.color }} aria-hidden="true" />
        <span>{part.label}</span><strong>{part.formatted}</strong>
      </li>)}</ul>
    </div> : <p className="role-dashboard-donut-empty" role="status">{emptyLabel}</p>}
    <p className="role-dashboard-donut-note">{note}</p>
  </figure>
}
