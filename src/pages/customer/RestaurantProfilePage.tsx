import { i18n } from '../../shared/i18n/i18n'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarCheck, ChevronDown, Clock, Maximize2, MapPin, Phone, Star, Table2, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { Restaurant } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAuth } from '../../shared/auth/AuthContext'
import { RoleIds, isInRole } from '../../shared/auth/authz'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { ContractGuardNotice } from '../../shared/ui/GuardNotice'
import { SafeImage } from '../../shared/ui/SafeImage'
import { WorkingHoursList } from '../../shared/ui/WorkingHoursField'
import { formatWorkingHoursSummary, getRestaurantOpenState } from '../../shared/lib/workingHours'
import './restaurant-profile.css'
import { RestaurantPhotoDialog } from './RestaurantPhotoDialog'

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
  const [photoOpen, setPhotoOpen] = useState(false)
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
    <main className="page restaurant-profile-page">
      <section className="restaurant-profile-cover" aria-labelledby="restaurant-profile-title">
        <SafeImage src={restaurant.image} alt={restaurant.name} fetchPriority="high" />
        <div className="restaurant-profile-cover-toolbar">
          <Link to="/" className="restaurant-profile-back" title={i18n.t('ui.nav.restaurants')}><ArrowLeft size={17} aria-hidden="true" />{i18n.t('ui.nav.restaurants')}</Link>
          <button type="button" className="restaurant-profile-photo-open" onClick={() => setPhotoOpen(true)} aria-label={i18n.t('ui.restaurantProfile.viewPhoto')} title={i18n.t('ui.restaurantProfile.viewPhoto')}><Maximize2 size={18} aria-hidden="true" /></button>
        </div>
        <div className="restaurant-profile-cover-caption">
          <div>
            <span className={`restaurant-profile-status${openState.isOpen ? ' is-open' : ''}`}><span aria-hidden="true" />{openState.label}</span>
            {restaurant.cuisine ? <p>{restaurant.cuisine}</p> : null}
            <h1 id="restaurant-profile-title">{restaurant.name}</h1>
          </div>
          {restaurant.rating > 0 ? <span className="restaurant-profile-rating"><Star size={16} fill="currentColor" aria-hidden="true" />{restaurant.rating} {i18n.t('ui.pages.customer.restaurant_profile_page.reytinq_ad3719')}</span> : null}
        </div>
      </section>
      <section className="restaurant-profile-information" aria-label={i18n.t('ui.pages.customer.restaurant_profile_page.restoran_profili_76281b')}>
        <div className="restaurant-profile-contact">
          <div className="restaurant-profile-address" title={restaurant.address}><MapPin size={19} aria-hidden="true" /><div><small>{i18n.t('ui.restaurantProfile.address')}</small><span>{restaurant.address}</span></div></div>
          {restaurant.phone ? <a href={`tel:${restaurant.phone}`}><Phone size={19} aria-hidden="true" /><div><small>{i18n.t('ui.restaurantProfile.phone')}</small><span>{restaurant.phone}</span></div><ArrowUpRight size={15} aria-hidden="true" /></a> : null}
        </div>
        <details className="restaurant-profile-hours">
          <summary>
            <Clock size={18} aria-hidden="true" />
            <span>{i18n.t('ui.workingHours.editor.hours')}</span>
            <strong>{formatWorkingHoursSummary(restaurant.workingHours, restaurant.timeZone, restaurant.todayWorkingHours)}</strong>
            <ChevronDown className="restaurant-profile-hours-chevron" size={18} aria-hidden="true" />
          </summary>
          <WorkingHoursList workingHours={restaurant.workingHours} variant="profile" />
        </details>
        <div className="restaurant-profile-booking">
          <ContractGuardNotice active={restaurant.hasActiveContract} />
          {isCustomer ? <Link className="ui-button ui-button-primary" to={`/restaurants/${restaurant.id}/reserve${reservationDate ? `?reservationDate=${encodeURIComponent(reservationDate)}` : ''}`}><CalendarCheck size={18} aria-hidden="true" />{i18n.t('ui.pages.customer.restaurant_profile_page.rezervasiyaya_basla_64753c')}<ArrowUpRight size={18} aria-hidden="true" /></Link> : null}
        </div>
      </section>
      <div className="restaurant-profile-navigation" role="group" aria-label={i18n.t('ui.pages.customer.restaurant_profile_page.restoran_profili_76281b')}>
        <button aria-pressed={activePanel === 'tables'} aria-controls="restaurant-profile-content" type="button" onClick={() => setActivePanel('tables')}><Table2 size={18} aria-hidden="true" />{i18n.t('ui.pages.customer.restaurant_profile_page.stollar_7880ee')}<span>{tablesLoading ? '\u2014' : tables.length}</span></button>
        <button aria-pressed={activePanel === 'menu'} aria-controls="restaurant-profile-content" type="button" onClick={() => setActivePanel('menu')}><BookOpen size={18} aria-hidden="true" />{i18n.t('ui.pages.customer.restaurant_profile_page.menyu_da3241')}<span>{menuLoading ? '\u2014' : menuData.items.length}</span></button>
      </div>

      <section className="public-profile-section" id="restaurant-profile-content">
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
                  <div className="restaurant-profile-table-top"><Table2 size={28} strokeWidth={1.5} aria-hidden="true" /><small className={`restaurant-profile-table-status${table.status === 'Available' ? ' is-available' : ''}`}>{i18n.t(`ui.adminFlow.tableStatus.${table.status}`, { defaultValue: table.status })}</small></div>
                  <strong>{table.name || `${tableLabel} ${table.number}`}</strong>
                  <span><UsersRound size={14} aria-hidden="true" />{i18n.t('ui.count.guests', { count: table.capacity })}</span>
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
                      aria-pressed={category.id === selectedCategory?.category.id}
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
                        <small>{item.description || i18n.t('ui.restaurantProfile.noDescription')}</small>
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
      {photoOpen ? <RestaurantPhotoDialog src={restaurant.image} name={restaurant.name} onClose={() => setPhotoOpen(false)} /> : null}
    </main>
  )
}
