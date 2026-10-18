import { i18n } from '../../shared/i18n/i18n'
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
import { RestaurantMobileModuleSection } from '../../features/mobileDownload/RestaurantMobileModuleSection'

export function RestaurantDetailPage() {
  const { restaurantId = '' } = useParams()
  const { user } = useAuth()
  const { data: restaurant, isLoading } = useAsyncData(() => ecafeApi.restaurants.adminDetail(restaurantId), null, [restaurantId])
  const canCreateContracts = isInRole(user, [RoleIds.PlatformAdmin])
  const canEditRestaurant = isInRole(user, [RoleIds.PlatformAdmin]) || isInRole(user, [RoleIds.Owner, RoleIds.Manager], restaurantId)

  if (isLoading || !restaurant) {
    return (
      <main className="admin-page narrow">
        <p className="online-only">{i18n.t('ui.pages.admin.restaurant_detail_page.restoran_melumatlari_yuklenir_b08a45')}</p>
      </main>
    )
  }

  const openState = getRestaurantOpenState(restaurant.workingHours, restaurant.timeZone, restaurant.isOpen)

  return (
    <main className="admin-page narrow">
      <PageHeader
        eyebrow={i18n.t('ui.pages.admin.restaurant_detail_page.restoran_c4df56')}
        title={restaurant.name}
        description={restaurant.restaurantGroupName || restaurant.branchName || restaurant.address}
      />

      <section className="detail-panel restaurant-detail-panel">
        <RestaurantStatusBadges restaurant={restaurant} openState={openState} />

        <dl>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.restoran_c4df56')}>{restaurant.name}</DetailItem>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.filial_86f44f')}>{restaurant.branchName || '-'}</DetailItem>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.qrup_14bb86')}>{restaurant.restaurantGroupName || '-'}</DetailItem>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.mekan_a979c9')} className="restaurant-detail-wide">
            <InlineDetail icon={<MapPin size={16} />}>{restaurant.address}</InlineDetail>
          </DetailItem>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.xerite_statusu_bee6bf')}>
            <LocationStatus restaurant={restaurant} />
          </DetailItem>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.telefon_fa6906')}>
            <InlineDetail icon={<Phone size={16} />}>{restaurant.phone}</InlineDetail>
          </DetailItem>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.is_saati_9c3651')}>
            <InlineDetail icon={<Clock size={16} />}>
              {formatWorkingHoursSummary(restaurant.workingHours, restaurant.timeZone, restaurant.todayWorkingHours)}
            </InlineDetail>
          </DetailItem>
          {restaurant.restaurantGroupEmail ? (
            <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.qrup_emaili_175521')}>{restaurant.restaurantGroupEmail}</DetailItem>
          ) : null}
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.heftelik_qrafik_7f018b')} className="restaurant-detail-schedule">
            <WorkingHoursList workingHours={restaurant.workingHours} />
          </DetailItem>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.servis_faizi_176e69')}>{restaurant.defaultServiceFeePercent}%</DetailItem>
          <DetailItem label={i18n.t('ui.pages.admin.restaurant_detail_page.legv_penceresi_216fd1')}>{restaurant.cancellationWindowMinutes ?? '-'} {i18n.t('ui.pages.admin.restaurant_detail_page.deqiqe_2a8106')}</DetailItem>
        </dl>
      </section>

      {canCreateContracts ? <RestaurantMobileModuleSection key={restaurantId} restaurantId={restaurantId} /> : null}

      <div className="form-actions">
        <ButtonLink to="/admin/restaurants" variant="secondary">{i18n.t('ui.pages.admin.restaurant_detail_page.siyahiya_qayit_f779ce')}</ButtonLink>
        {canEditRestaurant ? (
          <ButtonLink to={`/admin/restaurants/${restaurantId}/edit`} variant="secondary">{i18n.t('ui.pages.admin.restaurant_detail_page.redakte_et_5b03ba')}</ButtonLink>
        ) : null}
        {canCreateContracts ? (
          <ButtonLink to="/admin/contracts/new">
            <Building2 size={18} />
            {i18n.t('ui.pages.admin.restaurant_detail_page.muqavile_yarat_8aba1a')}
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
        {restaurant.hasActiveContract ?i18n.t('ui.pages.admin.restaurant_detail_page.aktiv_muqavile_var_cd7e4b') :i18n.t('ui.pages.admin.restaurant_detail_page.muqavile_yoxdur_649c6c')}
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
      {isVerified ?i18n.t('ui.pages.admin.restaurant_detail_page.unvan_xeritede_tesdiqlenib_2a45a3') :i18n.t('ui.pages.admin.restaurant_detail_page.unvan_xeritede_tesdiqlenmeyib_54f704')}
    </span>
  )
}
