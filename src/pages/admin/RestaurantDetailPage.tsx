import type { ReactNode } from 'react'
import { AlertTriangle, Building2, CheckCircle2, Clock, MapPin, Phone } from 'lucide-react'
import { useParams } from 'react-router-dom'
import type { Restaurant } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Badge } from '../../shared/ui/Badge'
import { ButtonLink } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { WorkingHoursList } from '../../shared/ui/WorkingHoursField'
import { formatWorkingHoursSummary, getRestaurantOpenState } from '../../shared/lib/workingHours'

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

  const openState = getRestaurantOpenState(restaurant.workingHours, restaurant.timeZone, restaurant.isOpen)

  return (
    <main className="admin-page narrow">
      <PageHeader
        eyebrow="Restoran"
        title={restaurant.name}
        description={restaurant.restaurantGroupName || restaurant.branchName || restaurant.address}
      />

      <section className="detail-panel restaurant-detail-panel">
        <RestaurantStatusBadges restaurant={restaurant} openState={openState} />

        <dl>
          <DetailItem label="Restoran">{restaurant.name}</DetailItem>
          <DetailItem label="Filial">{restaurant.branchName || '-'}</DetailItem>
          <DetailItem label="Qrup">{restaurant.restaurantGroupName || '-'}</DetailItem>
          <DetailItem label="Məkan" className="restaurant-detail-wide">
            <InlineDetail icon={<MapPin size={16} />}>{restaurant.address}</InlineDetail>
          </DetailItem>
          <DetailItem label="Xəritə statusu">
            <LocationStatus restaurant={restaurant} />
          </DetailItem>
          <DetailItem label="Telefon">
            <InlineDetail icon={<Phone size={16} />}>{restaurant.phone}</InlineDetail>
          </DetailItem>
          <DetailItem label="İş saatı">
            <InlineDetail icon={<Clock size={16} />}>
              {formatWorkingHoursSummary(restaurant.workingHours, restaurant.timeZone)}
            </InlineDetail>
          </DetailItem>
          {restaurant.restaurantGroupEmail ? (
            <DetailItem label="Qrup emaili">{restaurant.restaurantGroupEmail}</DetailItem>
          ) : null}
          <DetailItem label="Həftəlik qrafik" className="restaurant-detail-schedule">
            <WorkingHoursList workingHours={restaurant.workingHours} />
          </DetailItem>
          <DetailItem label="Depozit">{restaurant.depositAmount} ₼</DetailItem>
          <DetailItem label="Servis faizi">{restaurant.defaultServiceFeePercent}%</DetailItem>
          <DetailItem label="Ləğv pəncərəsi">{restaurant.cancellationWindowMinutes ?? '-'} dəqiqə</DetailItem>
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

type OpenState = ReturnType<typeof getRestaurantOpenState>

function RestaurantStatusBadges({ restaurant, openState }: { restaurant: Restaurant; openState: OpenState }) {
  return (
    <div className="contract-status-line">
      <Badge tone={restaurant.hasActiveContract ? 'success' : 'warning'}>
        {restaurant.hasActiveContract ? 'Aktiv müqavilə var' : 'Müqavilə yoxdur'}
      </Badge>
      <Badge tone={openState.tone}>{openState.label}</Badge>
    </div>
  )
}

function DetailItem({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function InlineDetail({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <span className="restaurant-detail-inline">
      {icon}
      {children}
    </span>
  )
}

function LocationStatus({ restaurant }: { restaurant: Restaurant }) {
  const isVerified = restaurant.latitude != null && restaurant.longitude != null

  return (
    <span className={isVerified ? 'location-status verified' : 'location-status unverified'}>
      {isVerified ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {isVerified ? 'Ünvan xəritədə təsdiqlənib' : 'Ünvan xəritədə təsdiqlənməyib'}
    </span>
  )
}
