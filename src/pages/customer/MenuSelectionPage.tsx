import { Minus, Plus, ReceiptText, ShoppingBasket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { PageHeader } from '../../shared/ui/PageHeader'

export function MenuSelectionPage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const { data: menuData, isLoading } = useAsyncData(
    async () => {
      const [categories, items] = await Promise.all([ecafeApi.menu.categories(restaurantId), ecafeApi.menu.items(restaurantId)])
      return { categories, items }
    },
    { categories: [], items: [] },
    [restaurantId],
  )
  const [activeCategory, setActiveCategory] = useState('all')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const { categories, items } = menuData

  const visibleItems = activeCategory === 'all' ? items : items.filter((item) => item.categoryId === activeCategory)
  const selectedItems = useMemo(
    () => items.map((item) => ({ item, quantity: quantities[item.id] ?? 0 })).filter((line) => line.quantity > 0),
    [items, quantities],
  )
  const subtotal = selectedItems.reduce((sum, line) => sum + line.item.price * line.quantity, 0)
  const serviceFee = subtotal * 0.1
  const total = subtotal + serviceFee

  const setQuantity = (itemId: string, quantity: number) => {
    setQuantities((current) => ({ ...current, [itemId]: Math.max(0, quantity) }))
  }

  return (
    <main className="page">
      <ReservationStepper activeStep={4} />
      <section className="menu-layout">
        <div className="menu-main">
          <PageHeader title="Menyu seçimi" description="Müştəri menyunu görə və seçim edə bilər. Rezerv/order yaratma backend flow-u növbəti mərhələdə bağlanacaq." />
          {isLoading ? <p className="online-only">Menyu yüklənir...</p> : null}
          {!isLoading && items.length === 0 ? <p className="online-only">Bu restoran üçün menyu tapılmadı.</p> : null}
          <div className="category-tabs">
            <button className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')} type="button">
              Hamısı
            </button>
            {categories.map((category) => (
              <button className={activeCategory === category.id ? 'active' : ''} key={category.id} onClick={() => setActiveCategory(category.id)} type="button">
                {category.name}
              </button>
            ))}
          </div>
          <div className="menu-grid">
            {visibleItems.map((item) => {
              const quantity = quantities[item.id] ?? 0
              const category = categories.find((entry) => entry.id === item.categoryId)

              return (
                <article className="menu-card" key={item.id}>
                  <div className="menu-card-image">
                    <img src={item.image} alt={item.name} />
                    <span>{category?.name ?? 'Menyu'}</span>
                  </div>
                  <div className="menu-card-body">
                    <div>
                      <h2>{item.name}</h2>
                      <strong>{item.price.toFixed(2)} ₼</strong>
                    </div>
                    <p>{item.description}</p>
                    <input placeholder="Item note / Qeyd" />
                    <footer>
                      <div className="quantity-control">
                        <button onClick={() => setQuantity(item.id, quantity - 1)} type="button" aria-label="Azalt">
                          <Minus size={18} />
                        </button>
                        <span>{quantity}</span>
                        <button onClick={() => setQuantity(item.id, quantity + 1)} type="button" aria-label="Artır">
                          <Plus size={18} />
                        </button>
                      </div>
                      <button className="add-link" onClick={() => setQuantity(item.id, quantity + 1)} type="button">
                        Əlavə et
                        <ShoppingBasket size={18} />
                      </button>
                    </footer>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
        <aside className="order-summary">
          <h2>
            <ReceiptText size={24} />
            Sifariş xülasəsi
          </h2>
          <div className="summary-list">
            {selectedItems.map(({ item, quantity }) => (
              <div key={item.id}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{quantity} ədəd</small>
                </span>
                <strong>{(item.price * quantity).toFixed(2)} ₼</strong>
              </div>
            ))}
          </div>
          <div className="summary-total">
            <div>
              <span>Cəmi:</span>
              <strong>{subtotal.toFixed(2)} ₼</strong>
            </div>
            <div>
              <span>Xidmət haqqı (10%):</span>
              <strong>{serviceFee.toFixed(2)} ₼</strong>
            </div>
            <div>
              <span>Yekun:</span>
              <strong>{total.toFixed(2)} ₼</strong>
            </div>
          </div>
          <p className="online-only">Ödəniş hələlik sistem üzərindən aparılmır. MVP-də müqavilə üzrə ödəniş fiziki/offline qəbul edilir.</p>
          <Link className="ui-button ui-button-primary full" to="/confirmation">
            Davam et
          </Link>
        </aside>
      </section>
    </main>
  )
}
