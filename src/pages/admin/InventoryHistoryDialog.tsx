import { ArrowDownLeft, ArrowUpRight, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { InventoryItem, InventoryMovement } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useKeyedAsyncData } from '../../shared/hooks/useAsyncData'
import { i18n } from '../../shared/i18n/i18n'
import { formatInventoryQuantity, inventoryUnitLabel } from '../../shared/lib/inventoryFormatting'
import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { Button } from '../../shared/ui/Button'
import { PaginationControls } from '../../shared/ui/PaginationControls'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './inventory-history.css'

type Props = {
  restaurantId: string
  item: InventoryItem
  restaurantTimeZone?: string | null
  onClose: () => void
}

const emptyHistory = {
  items: [] as InventoryMovement[], pageIndex: 1, totalPages: 1, totalCount: 0,
  hasPreviousPage: false, hasNextPage: false,
}

const movementNames: Record<number, string> = {
  1: 'purchase', 2: 'manualIncrease', 3: 'manualDecrease',
  4: 'orderConsumption', 5: 'waste', 6: 'stockReturn', 7: 'correction',
}

function utcInstant(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value) ? `${value}Z` : value
}

function movementTitle(movement: InventoryMovement) {
  if (movement.movementTypeId === 6 && movement.reversedMovementId !== null) return i18n.t('ui.inventoryHistory.cancellationReturn')
  const name = movementNames[movement.movementTypeId]
  return name ? i18n.t(`ui.inventoryHistory.type.${name}`) : movement.movementType || movement.movementTypeCode || i18n.t('ui.inventoryHistory.type.other')
}

function MovementRow({ movement, restaurantTimeZone }: { movement: InventoryMovement; restaurantTimeZone?: string | null }) {
  const isSystemMovement = movement.movementTypeId === 4 || movement.movementTypeId === 6 && movement.reversedMovementId !== null
  const timeZone = movement.timeZone || restaurantTimeZone || 'Asia/Baku'
  const createdAt = utcInstant(movement.createdAt)
  const reason = movement.reason?.trim()
  return <li className="inventory-history-row">
    <div className="inventory-history-row-main">
      <strong>{movementTitle(movement)}</strong>
      {movement.relatedOrderId || movement.tableNo || movement.orderItemName ? <div className="inventory-history-context">
        {movement.relatedOrderId ? <span>{i18n.t('ui.inventoryHistory.orderNumber', { id: movement.relatedOrderId })}</span> : null}
        {movement.tableNo ? <span>{i18n.t('ui.inventoryHistory.tableNumber', { number: movement.tableNo })}</span> : null}
        {movement.orderItemName ? <span>{movement.orderItemQuantity === null ? movement.orderItemName : i18n.t('ui.inventoryHistory.orderItem', { quantity: movement.orderItemQuantity, name: movement.orderItemName })}</span> : null}
      </div> : null}
      {!isSystemMovement && reason ? <p className="inventory-history-reason">{reason}</p> : null}
    </div>
    <strong className={`inventory-history-quantity ${movement.quantityChange >= 0 ? 'is-increase' : 'is-decrease'}`}>
      {movement.quantityChange >= 0 ? <ArrowDownLeft size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}
      {formatInventoryQuantity(movement.quantityChange, true)} {inventoryUnitLabel(movement.unitCode, movement.unitName)}
    </strong>
    <time dateTime={createdAt}>{formatReservationDateTime(createdAt, timeZone)}</time>
  </li>
}

export function InventoryHistoryDialog({ restaurantId, item, restaurantTimeZone, onClose }: Props) {
  const { i18n: activeI18n } = useTranslation()
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [retry, setRetry] = useState(0)
  const backdropRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const scope = `${restaurantId}:${item.id}`
  const history = useKeyedAsyncData(
    () => ecafeApi.inventory.movementsPaginated(restaurantId, item.id, { pageNumber, pageSize }),
    emptyHistory, `${scope}:${pageNumber}:${pageSize}:${activeI18n.resolvedLanguage}:${retry}`,
    [scope, pageNumber, pageSize, activeI18n.resolvedLanguage, retry],
  )
  const detail = useKeyedAsyncData(
    () => ecafeApi.inventory.detail(restaurantId, item.id),
    null as InventoryItem | null, `${scope}:${activeI18n.resolvedLanguage}:${retry}`,
    [scope, activeI18n.resolvedLanguage, retry],
  )

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    const background = Array.from(document.body.children).filter((node) => node !== backdropRef.current) as HTMLElement[]
    const previousInert = background.map((node) => node.inert)
    document.body.style.overflow = 'hidden'
    background.forEach((node) => { node.inert = true })
    dialogRef.current?.querySelector<HTMLElement>('.inventory-history-close')?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)') ?? [])
      if (!controls.length) { event.preventDefault(); dialogRef.current?.focus(); return }
      const first = controls[0]; const last = controls[controls.length - 1]
      if (!controls.includes(document.activeElement as HTMLElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      background.forEach((node, index) => { node.inert = previousInert[index] })
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0 }, [pageNumber, pageSize])
  useEffect(() => {
    if (history.hasData && pageNumber > history.data.totalPages) setPageNumber(Math.max(1, history.data.totalPages))
  }, [history.hasData, history.data.totalPages, pageNumber])

  return createPortal(<div ref={backdropRef} className="modal-backdrop inventory-history-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="inventory-history-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-history-title" tabIndex={-1}>
      <header className="inventory-history-header">
        <div><span className="eyebrow">{i18n.t('ui.inventoryHistory.eyebrow')}</span><h2 id="inventory-history-title">{detail.data?.name || item.name}</h2></div>
        <button type="button" className="inventory-history-close" aria-label={i18n.t('ui.inventoryHistory.close')} onClick={onClose}><X size={20} /></button>
      </header>
      <div ref={bodyRef} className="inventory-history-body">
        <div className="inventory-history-balance"><span>{i18n.t('ui.inventoryHistory.currentStock')}</span>
          {detail.isLoading ? <span role="status">{i18n.t('ui.inventoryHistory.loading')}</span>
            : detail.error || !detail.data ? <span className="inventory-history-balance-unavailable">{i18n.t('ui.inventoryHistory.currentUnavailable')}</span>
              : <strong>{formatInventoryQuantity(detail.data.quantityOnHand)} {inventoryUnitLabel(detail.data.unitCode, detail.data.unitName)}</strong>}
        </div>
        {detail.error ? <StatusMessage tone="warning" autoHideMs={false}>{detail.error}</StatusMessage> : null}
        {history.isLoading ? <p role="status" className="inventory-history-state">{i18n.t('ui.inventoryHistory.loading')}</p> : null}
        {history.error ? <div className="inventory-history-state"><StatusMessage tone="danger" autoHideMs={false}>{history.error === 'Məlumat yüklənmədi.' ? i18n.t('ui.inventoryHistory.loadFailed') : history.error}</StatusMessage><Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={16} />{i18n.t('ui.inventoryHistory.retry')}</Button></div> : null}
        {history.hasData && !history.error && history.data.items.length === 0 ? <p className="inventory-history-state">{i18n.t('ui.inventoryHistory.empty')}</p> : null}
        {history.hasData && !history.error && history.data.items.length > 0 ? <ol className="inventory-history-list">{history.data.items.map((movement) => <MovementRow key={movement.id} movement={movement} restaurantTimeZone={restaurantTimeZone} />)}</ol> : null}
      </div>
      <footer className="inventory-history-footer">
        {history.hasData && !history.error ? <><span>{i18n.t('ui.inventoryHistory.totalCount', { total: history.data.totalCount })}</span><PaginationControls ariaLabel={i18n.t('ui.inventoryHistory.pages')} pageIndex={history.data.pageIndex} pageSize={pageSize} totalCount={history.data.totalCount} totalPages={history.data.totalPages} hasPreviousPage={history.data.hasPreviousPage} hasNextPage={history.data.hasNextPage} onPageChange={setPageNumber} onPageSizeChange={(size) => { setPageSize(size); setPageNumber(1) }} /></> : null}
      </footer>
    </section>
  </div>, document.body)
}
