import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { BookOpen, Clock, MapPin, Phone, Star, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { Restaurant } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { ContractGuardNotice } from '../../shared/ui/GuardNotice'
import { SafeImage } from '../../shared/ui/SafeImage'
import { WorkingHoursList } from '../../shared/ui/WorkingHoursField'
import { formatWorkingHoursSummary, getRestaurantOpenState } from '../../shared/lib/workingHours'

type ProfilePanel = 'tables' | 'menu'

export function RestaurantProfilePage() {
  const { i18n: translation } = useTranslation()
  const language = translation.resolvedLanguage || translation.language
  const { restaurantId = 'saffron-premium' } = useParams()
  const [searchParams] = useSearchParams()
  const reservationDate = searchParams.get('reservationDate')
  const { user } = useAuth()
  const isCustomer = isInRole(user, [RoleIds.Customer])
  const [activePanel, setActivePanel] = useState<ProfilePanel>('tables')
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const { data: restaurant } = useAsyncData<Restaurant | null>(() => ecafeApi.restaurants.detail(restaurantId), null, [restaurantId, language])
  const { data: tables, isLoading: tablesLoading } = useAsyncData(() => ecafeApi.tables.listPublic(restaurantId), [], [restaurantId, language])
  const { data: menuData, isLoading: menuLoading } = useAsyncData(
    () => ecafeApi.menu.publicMenu(restaurantId),
    { categories: [], items: [] },
    [restaurantId, language],
  )

  const menuItemsByCategory = useMemo(
    () => menuData.categories.map((category) => ({
      category,
      items: menuData.items.filter((item) => item.categoryId === category.id),
    })),
    [menuData],
  )
  const selectedCategoryId = activeCategoryId || menuItemsByCategory[0]?.category.id || ''
  const selectedCategory = menuItemsByCategory.find((entry) => entry.category.id === selectedCategoryId) ?? menuItemsByCategory[0]

  if (!restaurant) {
    return (
      <main className="page">
        <p className="online-only">{i18n.t('ui.pages.customer.restaurant_profile_page.restoran_profili_yuklenir_c50c4e')}</p>
      </main>
    )
  }

  const openState = getRestaurantOpenState(restaurant.workingHours, restaurant.timeZone, restaurant.isOpen)
  const tableLabel = i18n.t('ui.pages.customer.table_selection_page.masa_058c4c')

  return (
    <main className="page">
      <section className="profile-layout">
        <SafeImage src={restaurant.image} alt={restaurant.name} />
        <article className="profile-panel">
          <span className="eyebrow">{i18n.t('ui.pages.customer.restaurant_profile_page.restoran_profili_76281b')}</span>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.cuisine}</p>
          <div className="profile-facts">
            <span>
              <Star size={18} fill="currentColor" />
              {restaurant.rating} {i18n.t('ui.pages.customer.restaurant_profile_page.reytinq_ad3719')}
            </span>
            <span>
              <MapPin size={18} />
              {restaurant.address}
            </span>
            <span>
              <Phone size={18} />
              {restaurant.phone}
            </span>
            <span>
              <Clock size={18} />
              {formatWorkingHoursSummary(restaurant.workingHours, restaurant.timeZone, restaurant.todayWorkingHours)}
            </span>
            <span className={openState.isOpen ? 'restaurant-open-status open' : 'restaurant-open-status closed'}>
              <Clock size={18} />
              {openState.label}
            </span>
          </div>
          <WorkingHoursList workingHours={restaurant.workingHours} />
          <ContractGuardNotice active={restaurant.hasActiveContract} />
          <div className="action-row profile-actions">
            {isCustomer ? (
              <Link className="ui-button ui-button-primary" to={`/restaurants/${restaurant.id}/reserve${reservationDate ? `?reservationDate=${encodeURIComponent(reservationDate)}` : ''}`}>{i18n.t('ui.pages.customer.restaurant_profile_page.rezervasiyaya_basla_64753c')}</Link>
            ) : null}
            <Button variant={activePanel === 'tables' ? 'primary' : 'secondary'} type="button" onClick={() => setActivePanel('tables')}>
              <Table2 size={18} />
              {i18n.t('ui.pages.customer.restaurant_profile_page.stollar_7880ee')}
            </Button>
            <Button variant={activePanel === 'menu' ? 'primary' : 'secondary'} type="button" onClick={() => setActivePanel('menu')}>
              <BookOpen size={18} />
              {i18n.t('ui.pages.customer.restaurant_profile_page.menyu_da3241')}
            </Button>
          </div>
        </article>
      </section>

      <section className="public-profile-section">
        {activePanel === 'tables' ? (
          <>
            <div className="section-heading">
              <span className="eyebrow">{i18n.t('ui.pages.customer.restaurant_profile_page.stollar_7880ee')}</span>
              <h2>{i18n.t('ui.pages.customer.restaurant_profile_page.stollar_7880ee')}</h2>
            </div>
            {tablesLoading ? <p className="online-only">{i18n.t('ui.pages.customer.restaurant_profile_page.stollar_yuklenir_c52fd0')}</p> : null}
            {!tablesLoading && tables.length === 0 ? <p className="online-only">{i18n.t('ui.pages.customer.restaurant_profile_page.bu_restoran_ucun_stol_tapilmadi_e9a52d')}</p> : null}
            <div className="choice-grid public-profile-grid">
              {tables.map((table) => (
                <article className="choice-card" key={table.id}>
                  <Table2 size={26} />
                  <strong>{table.name || `${tableLabel} ${table.number}`}</strong>
                  <span>{table.number ? `${tableLabel} ${table.number} · ` : ''}{i18n.t('ui.count.guests', { count: table.capacity })}</span>
                  <small>{i18n.t(`ui.adminFlow.tableStatus.${table.status}`, { defaultValue: table.status })}</small>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {activePanel === 'menu' ? (
          <>
            <div className="section-heading">
              <span className="eyebrow">{i18n.t('ui.pages.customer.restaurant_profile_page.menyu_da3241')}</span>
              <h2>{i18n.t('ui.pages.customer.restaurant_profile_page.menyu_da3241')}</h2>
            </div>
            {menuLoading ? <p className="online-only">{i18n.t('ui.pages.customer.restaurant_profile_page.menyu_yuklenir_b8bb64')}</p> : null}
            {!menuLoading && menuData.items.length === 0 ? <p className="online-only">{i18n.t('ui.pages.customer.restaurant_profile_page.bu_restoran_ucun_menyu_tapilmadi_468b62')}</p> : null}
            {menuItemsByCategory.length > 0 ? (
              <div className="public-menu-board">
                <div className="menu-category-tabs" aria-label={i18n.t('ui.pages.customer.restaurant_profile_page.menyu_kateqoriyalari_e23076')}>
                  {menuItemsByCategory.map(({ category, items }) => (
                    <button
                      className={category.id === selectedCategory?.category.id ? 'active' : ''}
                      key={category.id}
                      onClick={() => setActiveCategoryId(category.id)}
                      type="button"
                    >
                      <strong>{category.name}</strong>
                      <small>{i18n.t('ui.count.dishes', { count: items.length })}</small>
                    </button>
                  ))}
                </div>
                <div className="public-menu-table">
                  {selectedCategory?.items.map((item) => (
                    <article className="public-menu-row" key={item.id}>
                      <SafeImage src={item.image} alt={item.name} />
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.description || 'Tərkib qeyd edilməyib'}</small>
                      </div>
                      <span>{i18n.t('ui.count.sales', { count: item.salesCount ?? 0 })}</span>
                      <b>{item.price.toFixed(2)} ₼</b>
                    </article>
                  ))}
                  {selectedCategory && selectedCategory.items.length === 0 ? (
                    <p className="online-only">{i18n.t('ui.pages.customer.restaurant_profile_page.bu_kateqoriyada_yemek_yoxdur_05d38c')}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  )
}
