import { i18n } from '../../shared/i18n/i18n'
import { CheckCircle2, Minus, Plus, ReceiptText, ShoppingBasket, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ReservationDepositReviewDialog } from '../../features/menu/ReservationDepositReviewDialog'
import { getReservationErrorMessage, isDepositAmountChanged } from '../../features/menu/reservationErrors'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { PageHeader } from '../../shared/ui/PageHeader'
import { SafeImage } from '../../shared/ui/SafeImage'

export function MenuSelectionPage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reservedAt = searchParams.get('reservedAt')
  const tableId = searchParams.get('tableId')
  const acceptsLimitedSeating = searchParams.get('acceptsLimitedSeating') === 'true'
  const shownDepositAmountValue = searchParams.get('shownDepositAmount')
  const parsedShownDepositAmount = shownDepositAmountValue === null ? null : Number(shownDepositAmountValue)
  const shownDepositAmount = parsedShownDepositAmount !== null && Number.isFinite(parsedShownDepositAmount) && parsedShownDepositAmount >= 0
    ? parsedShownDepositAmount
    : null
  const parsedPeopleCount = Number(searchParams.get('peopleCount') || '1')
  const peopleCount = Number.isFinite(parsedPeopleCount) && parsedPeopleCount > 0 ? parsedPeopleCount : 1
  const { data: menuData, isLoading } = useAsyncData(
    () => ecafeApi.menu.publicMenu(restaurantId),
    { categories: [], items: [] },
    [restaurantId],
  )
  const { data: availability } = useAsyncData(
    () => reservedAt ? ecafeApi.tables.checkAvailability(restaurantId, reservedAt) : Promise.resolve(null),
    null,
    [restaurantId, reservedAt],
  )
  const [activeCategory, setActiveCategory] = useState('all')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [reservationError, setReservationError] = useState('')
  const [latestDepositAmount, setLatestDepositAmount] = useState<number | null>(null)
  const [pendingDepositAmount, setPendingDepositAmount] = useState<number | null>(null)
  const [acknowledgedDepositAmount, setAcknowledgedDepositAmount] = useState<number | null>(shownDepositAmount)
  const { categories, items } = menuData

  const visibleItems = activeCategory === 'all' ? items : items.filter((item) => item.categoryId === activeCategory)
  const selectedItems = useMemo(
    () => items.map((item) => ({ item, quantity: quantities[item.id] ?? 0 })).filter((line) => line.quantity > 0),
    [items, quantities],
  )
  const subtotal = selectedItems.reduce((sum, line) => sum + line.item.price * line.quantity, 0)
  const serviceFee = subtotal * 0.1
  const total = subtotal + serviceFee
  const confirmationPath = searchParams.toString() ? `/confirmation?${searchParams.toString()}` : '/confirmation'
  const displayedDepositAmount = latestDepositAmount ?? availability?.depositAmount

  const showLatestDeposit = async () => {
    if (!reservedAt) return false
    try {
      const amount = (await ecafeApi.tables.checkAvailability(restaurantId, reservedAt)).depositAmount
      if (amount === undefined) return false
      setLatestDepositAmount(amount)
      setPendingDepositAmount(amount)
      return true
    } catch {
      return false
    }
  }

  const createReservation = async (depositAmount: number) => {
    if (!reservedAt || !tableId) return

    const reservation = await ecafeApi.reservations.create(restaurantId, {
      tableId,
      reservedAt,
      peopleCount,
      acceptsLimitedSeating,
      expectedDepositAmount: depositAmount,
    })
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('shownDepositAmount')
    nextParams.set('reservationId', String(reservation.id))
    navigate(`/confirmation?${nextParams.toString()}`)
  }

  const handleContinue = async () => {
    if (!reservedAt || !tableId) {
      navigate(confirmationPath)
      return
    }

    setReservationError('')
    setIsCreatingReservation(true)

    try {
      const currentAvailability = await ecafeApi.tables.checkAvailability(restaurantId, reservedAt)
      const currentAmount = currentAvailability.depositAmount
      if (currentAmount === undefined) {
        setReservationError('Bu tarix üçün depozit məlumatı yüklənməyib. Səhifəni yeniləyib yenidən yoxlayın.')
        return
      }

      setLatestDepositAmount(currentAmount)
      if ((acknowledgedDepositAmount === null && currentAmount > 0) ||
          (acknowledgedDepositAmount !== null && currentAmount !== acknowledgedDepositAmount)) {
        setPendingDepositAmount(currentAmount)
        return
      }

      await createReservation(currentAmount)
    } catch (error) {
      if (isDepositAmountChanged(error) && await showLatestDeposit()) return
      setReservationError(getReservationErrorMessage(error))
    } finally {
      setIsCreatingReservation(false)
    }
  }

  const confirmDepositAmount = async () => {
    if (pendingDepositAmount === null) return

    setAcknowledgedDepositAmount(pendingDepositAmount)
    setReservationError('')
    setIsCreatingReservation(true)
    try {
      await createReservation(pendingDepositAmount)
      setPendingDepositAmount(null)
    } catch (error) {
      setPendingDepositAmount(null)
      if (isDepositAmountChanged(error) && await showLatestDeposit()) return
      setReservationError(getReservationErrorMessage(error))
    } finally {
      setIsCreatingReservation(false)
    }
  }

  const setQuantity = (itemId: string, quantity: number) => {
    setQuantities((current) => ({ ...current, [itemId]: Math.max(0, quantity) }))
  }

  return (
    <main className="page reservation-page reservation-menu-page">
      <ReservationStepper activeStep={3} />
      {reservedAt ? (
        <div className="reservation-selection-summary reservation-menu-summary">
          <div className="reservation-selection-summary-main">
            <div className="reservation-panel-icon"><CheckCircle2 size={20} /></div>
            <div><span>{i18n.t('ui.pages.customer.menu_selection_page.rezervasiya_ucun_seciminiz_df6e85')}</span><strong>{reservedAt.slice(0, 10)} / {reservedAt.slice(11, 16)}</strong></div>
          </div>
          <div><span className="reservation-summary-caption">{i18n.t('ui.pages.customer.menu_selection_page.masa_058c4c')}</span><strong>{tableId || 'Seçilməyib'}</strong></div>
          <div><span className="reservation-summary-caption">{i18n.t('ui.pages.customer.menu_selection_page.qonaq_sayi_012aa3')}</span><strong><Users size={16} /> {i18n.t('ui.count.guests', { count: peopleCount })}</strong></div>
          {displayedDepositAmount !== undefined ? (
            <div><span className="reservation-summary-caption">{i18n.t('ui.pages.customer.menu_selection_page.depozit_4a14b8')}</span><strong>{displayedDepositAmount > 0 ? `${displayedDepositAmount.toFixed(2)} AZN` :i18n.t('ui.pages.customer.menu_selection_page.teleb_olunmur_46f021')}</strong></div>
          ) : null}
        </div>
      ) : null}
      <section className="menu-layout">
        <div className="menu-main">
          <PageHeader title={i18n.t('ui.pages.customer.menu_selection_page.menyu_secimi_f16090')} />
          {isLoading ? <p className="online-only">{i18n.t('ui.pages.customer.menu_selection_page.menyu_yuklenir_b8bb64')}</p> : null}
          {!isLoading && items.length === 0 ? <p className="online-only">{i18n.t('ui.pages.customer.menu_selection_page.bu_restoran_ucun_menyu_tapilmadi_468b62')}</p> : null}
          <div className="category-tabs">
            <button className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')} type="button">{i18n.t('ui.pages.customer.menu_selection_page.hamisi_fba8f8')}</button>
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
                    <SafeImage src={item.image} alt={item.name} />
                    <span>{category?.name ?? 'Menyu'}</span>
                  </div>
                  <div className="menu-card-body">
                    <div>
                      <h2>{item.name}</h2>
                      <strong>{item.price.toFixed(2)} ₼</strong>
                    </div>
                    <p>{item.description || 'Tərkib qeyd edilməyib'}</p>
                    <input placeholder={i18n.t('ui.pages.customer.menu_selection_page.qeyd_5579df')} />
                    <footer>
                      <div className="quantity-control">
                        <button onClick={() => setQuantity(item.id, quantity - 1)} type="button" aria-label={i18n.t('ui.pages.customer.menu_selection_page.azalt_c045e6')}>
                          <Minus size={18} />
                        </button>
                        <span>{quantity}</span>
                        <button onClick={() => setQuantity(item.id, quantity + 1)} type="button" aria-label={i18n.t('ui.pages.customer.menu_selection_page.artir_e7a1a0')}>
                          <Plus size={18} />
                        </button>
                      </div>
                      <button className="add-link" onClick={() => setQuantity(item.id, quantity + 1)} type="button">
                        {i18n.t('ui.pages.customer.menu_selection_page.elave_et_fb2449')}
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
            {i18n.t('ui.pages.customer.menu_selection_page.sifaris_xulasesi_47a190')}
          </h2>
          <div className="summary-list">
            {selectedItems.map(({ item, quantity }) => (
              <div key={item.id}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{i18n.t('ui.count.items', { count: quantity })}</small>
                </span>
                <strong>{(item.price * quantity).toFixed(2)} ₼</strong>
              </div>
            ))}
          </div>
          <div className="summary-total">
            <div>
              <span>{i18n.t('ui.pages.customer.menu_selection_page.cemi_aa0a1d')}</span>
              <strong>{subtotal.toFixed(2)} ₼</strong>
            </div>
            <div>
              <span>{i18n.t('ui.pages.customer.menu_selection_page.xidmet_haqqi_10_4a7238')}</span>
              <strong>{serviceFee.toFixed(2)} ₼</strong>
            </div>
            <div>
              <span>{i18n.t('ui.pages.customer.menu_selection_page.yekun_f365a8')}</span>
              <strong>{total.toFixed(2)} ₼</strong>
            </div>
          </div>
          {reservationError ? <p className="reservation-availability-message danger">{reservationError}</p> : null}
          <Button className="full" disabled={isCreatingReservation} onClick={handleContinue} type="button">
            {isCreatingReservation ?i18n.t('ui.pages.customer.menu_selection_page.rezervasiya_yaradilir_b4b84c') :i18n.t('ui.pages.customer.menu_selection_page.davam_et_25f0fa')}
          </Button>
        </aside>
      </section>
      <ReservationDepositReviewDialog
        amount={pendingDepositAmount}
        isChanged={shownDepositAmount !== null}
        isSubmitting={isCreatingReservation}
        onCancel={() => setPendingDepositAmount(null)}
        onConfirm={() => void confirmDepositAmount()}
      />
    </main>
  )
}
