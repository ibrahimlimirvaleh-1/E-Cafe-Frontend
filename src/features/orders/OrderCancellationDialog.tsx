import { Ban, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CancellableOrder } from './useOrderCancellation'
import { i18n } from '../../shared/i18n/i18n'
import { Button } from '../../shared/ui/Button'
import './order-cancellation.css'

type Props = {
  order: CancellableOrder
  tableName: string
  busy: boolean
  error: string
  uncertainReason: string | null
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function OrderCancellationDialog({ order, tableName, busy, error, uncertainReason, onClose, onConfirm }: Props) {
  const [choice, setChoice] = useState('')
  const [other, setOther] = useState('')
  const dialogRef = useRef<HTMLElement | null>(null)
  const busyRef = useRef(busy)
  const closeRef = useRef(onClose)
  busyRef.current = busy
  closeRef.current = onClose
  const reason = uncertainReason ?? (choice === 'other' ? other.trim() : choice ? i18n.t(`ui.orderCancel.reason.${choice}`) : '')
  const valid = reason.trim().length >= 3 && reason.trim().length <= 500

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]') ?? [])
      .filter((element) => element.getClientRects().length > 0)
    ;(dialogRef.current?.querySelector<HTMLElement>('#order-cancel-reason') ?? controls()[0])?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!busyRef.current) closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = controls()
      if (!focusable.length) { event.preventDefault(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!focusable.includes(document.activeElement as HTMLElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
      else document.querySelector<HTMLElement>('main button:not(:disabled)')?.focus()
    }
  }, [])

  useEffect(() => {
    if (uncertainReason && !busy) dialogRef.current?.querySelector<HTMLElement>('.order-cancel-confirm')?.focus()
  }, [uncertainReason, busy])

  return createPortal(<div className="modal-backdrop reservation-action-backdrop" role="presentation">
    <section ref={dialogRef} className="reservation-action-dialog order-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="order-cancel-title" aria-describedby="order-cancel-description">
      <header className="reservation-action-dialog-header"><div className="reservation-action-dialog-icon" aria-hidden="true"><Ban size={20} /></div><button className="reservation-action-dialog-close" type="button" aria-label={i18n.t('ui.common.close')} disabled={busy} onClick={onClose}><X size={18} /></button></header>
      <div className="reservation-action-dialog-body">
        <h2 id="order-cancel-title">{i18n.t('ui.orderCancel.title', { id: order.id })}</h2>
        <p id="order-cancel-description">{i18n.t('ui.orderCancel.description')}</p>
        <div className="order-cancel-summary"><span>{tableName}</span><strong>{i18n.t('ui.orderCancel.products')}</strong><ul>{order.items.map((item, index) => <li key={`${item.name}:${index}`}>{item.quantity} × {item.name}</li>)}</ul></div>
        {uncertainReason ? <p className="order-cancel-locked">{i18n.t('ui.orderCancel.sameReason')} <strong>{uncertainReason}</strong></p> : <><label className="order-cancel-field" htmlFor="order-cancel-reason">{i18n.t('ui.orderCancel.reasonLabel')}<select id="order-cancel-reason" value={choice} disabled={busy} onChange={(event) => setChoice(event.target.value)}><option value="">{i18n.t('ui.orderCancel.chooseReason')}</option><option value="planChanged">{i18n.t('ui.orderCancel.reason.planChanged')}</option><option value="orderedByMistake">{i18n.t('ui.orderCancel.reason.orderedByMistake')}</option><option value="noLongerNeeded">{i18n.t('ui.orderCancel.reason.noLongerNeeded')}</option><option value="other">{i18n.t('ui.orderCancel.reason.other')}</option></select></label>{choice === 'other' ? <label className="order-cancel-field" htmlFor="order-cancel-other">{i18n.t('ui.orderCancel.otherReason')}<textarea id="order-cancel-other" value={other} disabled={busy} maxLength={500} rows={3} onChange={(event) => setOther(event.target.value)} /></label> : null}</>}
        {error ? <p className="order-cancel-error" role="alert">{error}</p> : null}
      </div>
      <footer className="reservation-action-dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>{i18n.t('ui.common.close')}</Button><Button type="button" variant="danger" className="order-cancel-confirm" disabled={busy || !valid} onClick={() => onConfirm(reason)}>{busy ? i18n.t('ui.orderCancel.wait') : uncertainReason ? i18n.t('ui.orderCancel.retry') : i18n.t('ui.orderCancel.confirm')}</Button></footer>
    </section>
  </div>, document.body)
}
