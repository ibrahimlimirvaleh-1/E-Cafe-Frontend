import { useEffect, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { SelectField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'

export function AuditLogPage() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const { data: restaurants } = useAsyncData(() => ecafeApi.restaurants.list(), [], [])
  const restaurantId = selectedRestaurantId || restaurants[0]?.id || ''
  const { data: logs, isLoading } = useAsyncData(
    () => (restaurantId ? ecafeApi.auditLogs.list(restaurantId) : Promise.resolve([])),
    [],
    [restaurantId],
  )

  useEffect(() => {
    if (!selectedRestaurantId && restaurants[0]) {
      setSelectedRestaurantId(restaurants[0].id)
    }
  }, [restaurants, selectedRestaurantId])

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Audit loglar"
        description="Vacib action-lar restoran üzrə izlənir: müqavilə yaradılması, təsdiq, aktivləşdirmə, fayl əməliyyatları və idarəetmə addımları."
      />

      <section className="admin-panel">
        <SelectField label="Restoran" required value={restaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
          {restaurants.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </SelectField>
      </section>

      <section className="admin-panel">
        <div>
          <span className="eyebrow">Flow history</span>
          <h2>Action siyahısı</h2>
        </div>
        {isLoading ? <p className="online-only">Audit loglar yüklənir...</p> : null}
        <div className="compact-list audit-list">
          {logs.map((log) => (
            <article key={log.id}>
              <div>
                <strong>{log.action || 'Action'}</strong>
                <small>{log.description || `${log.entityName} #${log.entityId}`}</small>
              </div>
              <div className="audit-meta">
                <Badge tone="info">{log.actorName || 'System'}</Badge>
                <small>{log.createdAt ? new Date(log.createdAt).toLocaleString('az-AZ') : '-'}</small>
              </div>
            </article>
          ))}
          {!isLoading && logs.length === 0 ? <p className="online-only">Bu restoran üçün audit log tapılmadı.</p> : null}
        </div>
      </section>
    </main>
  )
}
