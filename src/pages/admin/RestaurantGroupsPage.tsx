import { type FormEvent, useState } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/FormField'
import { PageHeader } from '../../shared/ui/PageHeader'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type RestaurantGroupsPageMode = 'list' | 'create'

export function RestaurantGroupsPage({ mode = 'list' }: { mode?: RestaurantGroupsPageMode }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [message, setMessage] = useState('')
  const { data: groups, isLoading } = useAsyncData(() => ecafeApi.restaurantGroups.list(), [], [reloadKey])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    await ecafeApi.restaurantGroups.create({ name, legalName })
    setName('')
    setLegalName('')
    setMessage('Restoran qrupu yaradıldı.')
    setReloadKey((value) => value + 1)
  }

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Admin"
        title={mode === 'create' ? 'Yeni restoran qrupu' : 'Restoran qrupları'}
        action={mode === 'list' ? <ButtonLink to="/admin/restaurant-groups/new">Yeni qrup</ButtonLink> : <ButtonLink to="/admin/restaurant-groups" variant="secondary">Siyahıya qayıt</ButtonLink>}
      />

      <section className="admin-single-column staff-list-layout">
        {mode === 'create' ? (
          <form className="admin-panel" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">Yeni qrup</span>
              <h2>Qrup məlumatları</h2>
            </div>
            <TextField label="Qrup adı" required value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label="Legal ad" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
            <Button type="submit">Qrup yarat</Button>
            {message ? <StatusMessage>{message}</StatusMessage> : null}
          </form>
        ) : (
          <section className="admin-panel">
            <div>
              <span className="eyebrow">Siyahı</span>
              <h2>Mövcud qruplar</h2>
            </div>
            {isLoading ? <p className="online-only">Qruplar yüklənir...</p> : null}
            <div className="compact-list">
              {groups.map((group) => (
                <article key={group.id}>
                  <div>
                    <strong>{group.name}</strong>
                    <small>{group.legalName || 'Legal ad qeyd edilməyib'}</small>
                  </div>
                  <Badge tone={group.isActive ? 'success' : 'neutral'}>{group.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
                </article>
              ))}
              {!isLoading && groups.length === 0 ? <p className="online-only">Hələ restoran qrupu yoxdur.</p> : null}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export function RestaurantGroupCreatePage() {
  return <RestaurantGroupsPage mode="create" />
}
