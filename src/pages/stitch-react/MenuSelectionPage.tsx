import { Minus, Plus, ReceiptText, ShoppingBasket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ReserveStepper } from '../../components/stitch-react/ReserveStepper'
import { SiteHeader } from '../../components/stitch-react/SiteHeader'
import { getMenuCategories, getMenuItems } from '../../services/menuService'
import type { OrderLine } from '../../services/menuService'
import '../../styles/stitchReact.css'

const serviceFeeRate = 0.1

function formatMoney(value: number) {
  return `${value.toFixed(2)} ₼`
}

export function MenuSelectionPage() {
  const categories = getMenuCategories()
  const items = getMenuItems()
  const [activeCategory, setActiveCategory] = useState('all')
  const [orderLines, setOrderLines] = useState<Record<string, OrderLine>>({
    'shah-plov': { itemId: 'shah-plov', quantity: 1 },
    'pomegranate-drink': { itemId: 'pomegranate-drink', quantity: 2 },
  })

  const visibleItems = useMemo(
    () => (activeCategory === 'all' ? items : items.filter((item) => item.categoryId === activeCategory)),
    [activeCategory, items],
  )

  const selectedItems = useMemo(
    () =>
      items
        .map((item) => ({ item, quantity: orderLines[item.id]?.quantity ?? 0 }))
        .filter(({ quantity }) => quantity > 0),
    [items, orderLines],
  )

  const subtotal = selectedItems.reduce((sum, line) => sum + line.item.price * line.quantity, 0)
  const serviceFee = subtotal * serviceFeeRate
  const total = subtotal + serviceFee

  const updateQuantity = (itemId: string, nextQuantity: number) => {
    setOrderLines((current) => ({
      ...current,
      [itemId]: {
        itemId,
        note: current[itemId]?.note,
        quantity: Math.max(0, nextQuantity),
      },
    }))
  }

  const updateNote = (itemId: string, note: string) => {
    setOrderLines((current) => ({
      ...current,
      [itemId]: {
        itemId,
        quantity: current[itemId]?.quantity ?? 0,
        note,
      },
    }))
  }

  return (
    <div className="stitch-react sr-page-shell">
      <SiteHeader />
      <main className="sr-container">
        <ReserveStepper activeStep={3} />

        <div className="sr-menu-layout">
          <section className="sr-menu-content">
            <div className="sr-page-title">
              <h1>Öncədən sifariş</h1>
              <p>Gəlişinizdən əvvəl sevdiyiniz təamları seçin, vaxtınıza qənaət edin.</p>
            </div>

            <div className="sr-category-tabs" aria-label="Menyu kateqoriyaları">
              {categories.map((category) => (
                <button
                  className={category.id === activeCategory ? 'active' : ''}
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  type="button"
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="sr-menu-grid">
              {visibleItems.map((item) => {
                const line = orderLines[item.id]
                const quantity = line?.quantity ?? 0

                return (
                  <article className="sr-menu-card" key={item.id}>
                    <div className="sr-menu-image">
                      <img src={item.image} alt={item.imageAlt} />
                      <span>{item.categoryLabel}</span>
                    </div>
                    <div className="sr-menu-card-body">
                      <div className="sr-menu-card-head">
                        <h2>{item.name}</h2>
                        <strong>{formatMoney(item.price)}</strong>
                      </div>
                      <p>{item.description}</p>
                      <input
                        aria-label={`${item.name} üçün qeyd`}
                        onChange={(event) => updateNote(item.id, event.target.value)}
                        placeholder="Item note / Qeyd"
                        value={line?.note ?? ''}
                      />
                      <div className="sr-menu-card-actions">
                        <div className="sr-quantity">
                          <button onClick={() => updateQuantity(item.id, quantity - 1)} type="button" aria-label="Azalt">
                            <Minus size={18} />
                          </button>
                          <span>{quantity}</span>
                          <button onClick={() => updateQuantity(item.id, quantity + 1)} type="button" aria-label="Artır">
                            <Plus size={18} />
                          </button>
                        </div>
                        <button className="sr-add-button" onClick={() => updateQuantity(item.id, quantity + 1)} type="button">
                          Əlavə et
                          <ShoppingBasket size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <aside className="sr-order-summary">
            <h2>
              <ReceiptText size={24} />
              Sifariş Xülasəsi
            </h2>

            <div className="sr-summary-items">
              {selectedItems.length ? (
                selectedItems.map(({ item, quantity }) => (
                  <div className="sr-summary-item" key={item.id}>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{quantity} ədəd</small>
                    </span>
                    <strong>{formatMoney(item.price * quantity)}</strong>
                  </div>
                ))
              ) : (
                <p className="sr-empty-summary">Hələ məhsul seçilməyib.</p>
              )}
            </div>

            <div className="sr-summary-totals">
              <div>
                <span>Cəmi:</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              <div>
                <span>Xidmət haqqı (10%):</span>
                <strong>{formatMoney(serviceFee)}</strong>
              </div>
              <div className="sr-grand-total">
                <span>Yekun:</span>
                <strong>{formatMoney(total)}</strong>
              </div>
            </div>

            <div className="sr-summary-notes">
              <p>
                <span className="material-symbols-outlined">payments</span>
                Ödəniş: Yalnız onlayn
              </p>
              <p>
                <span className="material-symbols-outlined">restaurant</span>
                Sifariş ödənişdən sonra mətbəxə göndəriləcək.
              </p>
            </div>

            <Link className="sr-primary-action" to="/confirmation">
              Davam et
            </Link>
            <Link className="sr-back-action" to="/restaurants/saffron-premium/waiters">
              Geri qayıt
            </Link>
          </aside>
        </div>
      </main>
    </div>
  )
}
