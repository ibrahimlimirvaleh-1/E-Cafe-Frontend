import type { Metric } from '../types/domain'

type MetricCardProps = {
  metric: Metric
}

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <article className={`metric-card ${metric.tone}`}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.hint}</small>
    </article>
  )
}
