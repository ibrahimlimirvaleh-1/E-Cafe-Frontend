import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ecafeApi, type WaiterTableSessionResponse } from '../../shared/api/ecafeApi'
import type { PaginatedResponse } from '../../shared/api/responseUtils'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { ButtonLink } from '../../shared/ui/Button'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import { SessionCloseReviewActions } from './SessionCloseReviewActions'

const emptyPage: PaginatedResponse<WaiterTableSessionResponse> = {
  items: [], pageIndex: 1, totalPages: 1, totalCount: 0, hasNextPage: false, hasPreviousPage: false,
}

type Props = { restaurantId: string; userId: string; reloadKey: number }

export function RestaurantSessionCloseReviewQueue({ restaurantId, userId, reloadKey }: Props) {
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const scopeKey = `${userId}:${restaurantId}:${page}`
  const queue = useKeyedAsyncData(
    () => restaurantId ? ecafeApi.tableSessions.listCloseReviews(restaurantId, page) : Promise.resolve(emptyPage),
    emptyPage, scopeKey, [reloadKey, revision],
  )

  useEffect(() => { setPage(1); setNotice('') }, [restaurantId])
  useEffect(() => {
    if (queue.hasData && page > queue.data.totalPages) setPage(Math.max(1, queue.data.totalPages))
  }, [page, queue.data.totalPages, queue.hasData])
  useEffect(() => {
    if (location.hash === '#session-close-review' && queue.hasData && !queue.isLoading) {
      document.getElementById('session-close-review')?.scrollIntoView({ block: 'start' })
    }
  }, [location.key, location.hash, queue.hasData, queue.isLoading])

  if (!restaurantId || (!queue.isLoading && !queue.error && queue.hasData && queue.data.totalCount === 0 && !notice)) return null

  return <section className="session-close-review-queue" id="session-close-review" aria-label="Bağlanması yoxlanmalı masa sessiyaları">
    <div className="session-close-review-queue-header"><h2>Bağlanması yoxlanmalı masalar</h2>{queue.hasData && !queue.error ? <span>{queue.data.totalCount} sessiya</span> : null}</div>
    {queue.error ? <StatusMessage tone="danger" autoHideMs={false}>Yoxlama növbəsi yüklənmədi: {queue.error}</StatusMessage> : null}
    {notice ? <StatusMessage tone="success" autoHideMs={false}>{notice}</StatusMessage> : null}
    {queue.isLoading ? <p role="status">Yoxlama növbəsi yüklənir...</p> : null}
    {queue.hasData && !queue.error && queue.data.items.length > 0 ? <div className="session-close-review-queue-list">
      {queue.data.items.map((session) => <article className="session-close-review-queue-row" key={session.id}>
        <div className="session-close-review-queue-row-main"><strong>{session.tableName || `Masa-${session.tableNo}`}</strong><span>{session.customerName || 'Qonaq adı qeyd olunmayıb'}{session.reservationId !== null ? ` · Rezervasiya #${session.reservationId}` : ''}</span></div>
        <span className="session-close-review-queue-row-time">Yoxlama vaxtı: {formatReservationDateTime(session.closeReviewDueAt, session.timeZone)}</span>
        {session.reservationId !== null ? <ButtonLink variant="secondary" to={`/admin/reservations/${session.reservationId}?restaurantId=${restaurantId}`}>Detal <ArrowRight size={16} /></ButtonLink> : null}
        <SessionCloseReviewActions restaurantId={restaurantId} reservationId={session.reservationId} sessionId={session.id} canComplete={session.reservationId !== null} completeAs="manager" canContinue={session.requiresCloseReview} requiresReview={session.requiresCloseReview} reviewDueAt={session.closeReviewDueAt} reviewConfirmedAt={session.closeReviewConfirmedAt} timeZone={session.timeZone} onChanged={(message) => { setNotice(message); setRevision((value) => value + 1) }} />
      </article>)}
    </div> : null}
    {queue.hasData && !queue.error && queue.data.totalCount > 0 ? <PaginationControls ariaLabel="Yoxlama növbəsi səhifələri" pageIndex={queue.data.pageIndex} totalPages={queue.data.totalPages} totalCount={queue.data.totalCount} pageSize={20} hasPreviousPage={queue.data.hasPreviousPage} hasNextPage={queue.data.hasNextPage} onPageChange={setPage} /> : null}
  </section>
}
