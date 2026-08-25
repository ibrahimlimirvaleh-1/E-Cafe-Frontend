import { Building2, MapPin, Phone } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'

export function RestaurantDetailPage() {
  const { restaurantId = '' } = useParams()
  const { user } = useAuth()
  const { data: restaurant, isLoading } = useAsyncData(() => ecafeApi.restaurants.adminDetail(restaurantId), null, [restaurantId])
  const canCreateContracts = isInRole(user, [RoleIds.PlatformAdmin])

  if (isLoading || !restaurant) {
    return (
      <main className="admin-page narrow">
        <p className="online-only">Restoran məlumatları yüklənir...</p>
      </main>
    )
  }

  return (
    <main className="admin-page narrow">
      <PageHeader
        eyebrow="Restoran"
        title={restaurant.name}
        description={restaurant.restaurantGroupName || restaurant.branchName || restaurant.address}
      />

      <section className="detail-panel contract-detail-panel">
        <div className="contract-status-line">
          <Badge tone={restaurant.isActive ? 'success' : 'danger'}>{restaurant.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
          <Badge tone={restaurant.hasActiveContract ? 'success' : 'warning'}>
            {restaurant.hasActiveContract ? 'Aktiv müqavilə var' : 'Müqavilə yoxdur'}
          </Badge>
        </div>

        <dl>
          <div>
            <dt>Restoran</dt>
            <dd>{restaurant.name}</dd>
          </div>
          <div>
            <dt>Filial</dt>
            <dd>{restaurant.branchName || '-'}</dd>
          </div>
          <div>
            <dt>Qrup</dt>
            <dd>{restaurant.restaurantGroupName || '-'}</dd>
          </div>
          <div>
            <dt>Məkan</dt>
            <dd><MapPin size={16} /> {restaurant.address}</dd>
          </div>
          <div>
            <dt>Telefon</dt>
            <dd><Phone size={16} /> {restaurant.phone}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{restaurant.email || '-'}</dd>
          </div>
          <div>
            <dt>Depozit</dt>
            <dd>{restaurant.depositAmount} ₼</dd>
          </div>
          <div>
            <dt>Servis faizi</dt>
            <dd>{restaurant.defaultServiceFeePercent}%</dd>
          </div>
          <div>
            <dt>Ləğv pəncərəsi</dt>
            <dd>{restaurant.cancellationWindowMinutes ?? '-'} dəqiqə</dd>
          </div>
        </dl>
      </section>

      <div className="form-actions">
        <ButtonLink to="/admin/restaurants" variant="secondary">
          Siyahıya qayıt
        </ButtonLink>
        {canCreateContracts ? (
          <ButtonLink to="/admin/contracts/new">
            <Building2 size={18} />
            Müqavilə yarat
          </ButtonLink>
        ) : null}
      </div>
    </main>
  )
}
