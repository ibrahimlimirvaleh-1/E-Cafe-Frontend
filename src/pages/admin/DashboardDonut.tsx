import { useId, useMemo, useState } from 'react'

type DonutPart = { key: string; label: string; value: number; formatted: string; color: string }

type Props = {
  title: string
  total: number
  totalLabel: string
  totalFormatted: string
  parts: DonutPart[]
  locale: string
  scope: string
  emptyLabel: string
  note: string
}

export function DashboardDonut({ title, total, totalLabel, totalFormatted, parts, locale, scope, emptyLabel, note }: Props) {
  const id = useId()
  const percent = useMemo(() => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }), [locale])
  const [selection, setSelection] = useState<{ dataset: string; key: string } | null>(null)
  const dataset = JSON.stringify([scope, total, parts.map(({ key, value }) => [key, value])])
  const active = selection?.dataset === dataset ? parts.find((part) => part.key === selection.key) : undefined
  if (selection && selection.dataset !== dataset) setSelection(null)
  const displayedValue = active?.formatted ?? totalFormatted

  const sum = parts.reduce((value, part) => value + part.value, 0)
  if (!Number.isFinite(total) || total < 0 || parts.some((part) => !Number.isFinite(part.value) || part.value < 0) || Math.abs(sum - total) > Number.EPSILON * Math.max(1, total) * parts.length * 4) return null

  function select(key: string) {
    setSelection(active?.key === key ? null : { dataset, key })
  }

  function formatShare(value: number) {
    const ratio = value / total
    if (ratio > 0 && ratio < .001) return `< ${percent.format(.001)}`
    if (ratio < 1 && ratio > .999) return `> ${percent.format(.999)}`
    return percent.format(ratio)
  }

  let position = 0
  const arcs = parts.filter((part) => part.value > 0).map((part, index, positiveParts) => {
    const start = position
    position = index === positiveParts.length - 1 ? 100 : position + part.value / total * 100
    const duration = (750 + 90 * (positiveParts.length - 1)) / positiveParts.length
    return { part, start, length: position - start, duration, delay: index * (duration - 90) }
  })

  return <figure className="role-dashboard-donut" onKeyDown={(event) => {
    if (event.key === 'Escape' && active) {
      event.stopPropagation()
      setSelection(null)
    }
  }}>
    <figcaption id={id}>{title}</figcaption>
    {total > 0 ? <div className="role-dashboard-donut-content">
      <div className="role-dashboard-donut-ring">
        <svg className="role-dashboard-donut-plot" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
          <circle className="role-dashboard-donut-track" cx="80" cy="80" r="67" />
          {arcs.map(({ part, start, length, duration, delay }) => (
            <circle className={`role-dashboard-donut-arc${active ? active.key === part.key ? ' is-active' : ' is-muted' : ''}`}
              key={part.key} cx="80" cy="80" r="67" pathLength="100" transform={`rotate(${start * 3.6 - 90} 80 80)`}
              style={{ stroke: part.color, strokeDasharray: `${length} 100`, animationDuration: `${duration}ms`, animationDelay: `${delay}ms` }}
              onClick={() => {
                select(part.key)
                document.getElementById(`${id}-${part.key}`)?.focus({ preventScroll: true })
              }} />
          ))}
        </svg>
        <div className="role-dashboard-donut-center" role="status">
          <strong className={displayedValue.length > 12 ? 'is-long' : undefined}>{displayedValue}</strong>
          <span>{active?.label ?? totalLabel}</span>
          <span className="role-dashboard-donut-share">{active ? formatShare(active.value) : null}</span>
        </div>
      </div>
      <ul aria-labelledby={id}>{parts.map((part) => <li key={part.key}>
        <button type="button" className="role-dashboard-donut-option" id={`${id}-${part.key}`}
          aria-pressed={active?.key === part.key} onClick={() => select(part.key)}>
          <i style={{ background: part.color }} aria-hidden="true" />
          <span>{part.label}</span>
          <span className="role-dashboard-donut-values"><strong>{part.formatted}</strong><span>{formatShare(part.value)}</span></span>
        </button>
      </li>)}</ul>
    </div> : <p className="role-dashboard-donut-empty" role="status">{emptyLabel}</p>}
    <p className="role-dashboard-donut-note">{note}</p>
  </figure>
}
