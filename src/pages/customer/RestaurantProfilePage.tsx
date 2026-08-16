import { BadgeCheck, BookOpen, Clock, MapPin, Phone, ShieldCheck, Star, Table2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Restaurant } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { ContractGuardNotice } from '../../shared/ui/GuardNotice'
import { SafeImage } from '../../shared/ui/SafeImage'

type ProfilePanel = 'staff' | 'tables' | 'menu'

export function RestaurantProfilePage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const [activePanel, setActivePanel] = useState<ProfilePanel>('staff')
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const { data: restaurant } = useAsyncData<Restaurant | null>(() => ecafeApi.restaurants.detail(restaurantId), null, [restaurantId])
  const { data: staff, isLoading: staffLoading } = useAsyncData(() => ecafeApi.staff.waiters(restaurantId), [], [restaurantId])
  const { data: tables, isLoading: tablesLoading } = useAsyncData(() => ecafeApi.tables.listPublic(restaurantId), [], [restaurantId])
  const { data: menuData, isLoading: menuLoading } = useAsyncData(
    async () => {
      const [categories, items] = await Promise.all([ecafeApi.menu.categories(restaurantId), ecafeApi.menu.items(restaurantId)])
      return { categories, items }
    },
    { categories: [], items: [] },
    [restaurantId],
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
        <p className="online-only">Restoran profili yüklənir...</p>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="profile-layout">
        <SafeImage src={restaurant.image} alt={restaurant.name} />
        <article className="profile-panel">
          <span className="eyebrow">Restoran profili</span>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.cuisine}</p>
          <div className="profile-facts">
            <span>
              <Star size={18} fill="currentColor" />
              {restaurant.rating} reytinq
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
              Rezervasiya qaydaları restoran tərəfindən idarə olunur
            </span>
            <span>
              <ShieldCheck size={18} />
              Ödəniş fiziki/offline
            </span>
          </div>
          <ContractGuardNotice active={restaurant.hasActiveContract} />
          <div className="action-row profile-actions">
            <Link className="ui-button ui-button-primary" to={`/restaurants/${restaurant.id}/tables`}>
              Rezervasiyaya başla
            </Link>
            <Button variant={activePanel === 'staff' ? 'primary' : 'secondary'} type="button" onClick={() => setActivePanel('staff')}>
              <Users size={18} />
              İşçilər
            </Button>
            <Button variant={activePanel === 'tables' ? 'primary' : 'secondary'} type="button" onClick={() => setActivePanel('tables')}>
              <Table2 size={18} />
              Stollar
            </Button>
            <Button variant={activePanel === 'menu' ? 'primary' : 'secondary'} type="button" onClick={() => setActivePanel('menu')}>
              <BookOpen size={18} />
              Menyu
            </Button>
          </div>
        </article>
      </section>

      <section className="public-profile-section">
        {activePanel === 'staff' ? (
          <>
            <div className="section-heading">
              <span className="eyebrow">İşçilər</span>
              <h2>İşçilər</h2>
            </div>
            {staffLoading ? <p className="online-only">İşçilər yüklənir...</p> : null}
            {!staffLoading && staff.length === 0 ? <p className="online-only">Bu restoran üçün işçi tapılmadı.</p> : null}
            <div className="choice-grid public-profile-grid">
              {staff.map((member) => (
                <article className="choice-card" key={member.id}>
                  <BadgeCheck size={26} />
                  <strong>{member.name}</strong>
                  <span>{member.role}</span>
                  <small>
                    {member.effectiveMaxActiveTableCount == null
                      ? `${member.activeTableSessionCount ?? 0} aktiv masa`
                      : `${member.activeTableSessionCount ?? 0}/${member.effectiveMaxActiveTableCount} masa`}
                  </small>
                  <small>{member.serviceFeePercent == null ? 'Servis faizi restoran qaydasına görədir' : `Servis faizi ${member.serviceFeePercent}%`}</small>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {activePanel === 'tables' ? (
          <>
            <div className="section-heading">
              <span className="eyebrow">Stollar</span>
              <h2>Stollar</h2>
            </div>
            {tablesLoading ? <p className="online-only">Stollar yüklənir...</p> : null}
            {!tablesLoading && tables.length === 0 ? <p className="online-only">Bu restoran üçün stol tapılmadı.</p> : null}
            <div className="choice-grid public-profile-grid">
              {tables.map((table) => (
                <article className="choice-card" key={table.id}>
                  <Table2 size={26} />
                  <strong>{table.number}</strong>
                  <span>{table.capacity} nəfərlik stol</span>
                  <small>{table.status === 'Available' ? 'Boşdur' : table.status}</small>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {activePanel === 'menu' ? (
          <>
            <div className="section-heading">
              <span className="eyebrow">Menyu</span>
              <h2>Menyu</h2>
            </div>
            {menuLoading ? <p className="online-only">Menyu yüklənir...</p> : null}
            {!menuLoading && menuData.items.length === 0 ? <p className="online-only">Bu restoran üçün menyu tapılmadı.</p> : null}
            {menuItemsByCategory.length > 0 ? (
              <div className="public-menu-board">
                <div className="menu-category-tabs" aria-label="Menyu kateqoriyaları">
                  {menuItemsByCategory.map(({ category, items }) => (
                    <button
                      className={category.id === selectedCategory?.category.id ? 'active' : ''}
                      key={category.id}
                      onClick={() => setActiveCategoryId(category.id)}
                      type="button"
                    >
                      <strong>{category.name}</strong>
                      <small>{items.length} yemək</small>
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
                      <span>{item.salesCount ?? 0} satış</span>
                      <b>{item.price.toFixed(2)} ₼</b>
                    </article>
                  ))}
                  {selectedCategory && selectedCategory.items.length === 0 ? (
                    <p className="online-only">Bu kateqoriyada yemək yoxdur.</p>
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
