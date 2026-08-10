import { BadgeCheck, WalletCards } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ReservationStepper } from '../../features/menu/ReservationStepper'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { PageHeader } from '../../shared/ui/PageHeader'

export function WaiterSelectionPage() {
  const { restaurantId = 'saffron-premium' } = useParams()
  const { data: waiters, isLoading } = useAsyncData(() => ecafeApi.staff.waiters(restaurantId), [], [restaurantId])

  return (
    <main className="page">
      <ReservationStepper activeStep={3} />
      <PageHeader title="Ofisiant sec" />
      {isLoading ? <p className="online-only">Ofisiantlar yuklenir...</p> : null}
      {!isLoading && waiters.length === 0 ? <p className="online-only">Bu restoran ucun ofisiant tapilmadi.</p> : null}
      <section className="choice-grid">
        {waiters.map((waiter) => {
          const capacityText = waiter.effectiveMaxActiveTableCount == null
            ? `${waiter.activeTableSessionCount ?? 0} aktiv masa`
            : `${waiter.activeTableSessionCount ?? 0}/${waiter.effectiveMaxActiveTableCount} masa`
          const content = (
            <>
              <BadgeCheck size={26} />
              <strong>{waiter.name}</strong>
              <span>{waiter.canAcceptMoreTables === false ? 'Hazirda limiti doludur' : 'Secim ucun uygundur'}</span>
              <small>
                <WalletCards size={15} />
                {capacityText}
              </small>
              <small>{waiter.serviceFeePercent == null ? 'Servis faizi restoran qaydasina goredir' : `Servis faizi: ${waiter.serviceFeePercent}%`}</small>
            </>
          )

          return waiter.canAcceptMoreTables === false ? (
            <article className="choice-card disabled-choice-card" key={waiter.id}>
              {content}
            </article>
          ) : (
            <Link className="choice-card" key={waiter.id} to={`/restaurants/${restaurantId}/menu`}>
              {content}
            </Link>
          )
        })}
      </section>
    </main>
  )
}
