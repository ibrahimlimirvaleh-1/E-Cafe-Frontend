import { AlertCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { i18n } from '../../shared/i18n/i18n'
import { Button } from '../../shared/ui/Button'
import type { CancellationOperation, RequestableOrder } from './useCancellationRequestAction'
import { CancellationRequestInfo } from './CancellationRequestInfo'
import './cancellation-request.css'

type Props = {
  order: RequestableOrder & { items: { name: string; quantity: number }[] }
  operation: CancellationOperation
  busy: boolean
  error: string
  uncertainReason: string | null
  onClose: () => void
  onConfirm: (reason: string) => void
  decisionChoice?: 'approve' | 'reject' | null
  onDecisionChoice?: (choice: 'approve' | 'reject') => void
}

export function CancellationRequestDialog({ order, operation, busy, error, uncertainReason, onClose, onConfirm, decisionChoice, onDecisionChoice }: Props) {
  const [choice, setChoice] = useState('')
  const [customReason, setCustomReason] = useState('')
  const dialogRef = useRef<HTMLElement | null>(null)
  const busyRef = useRef(busy)
  const closeRef = useRef(onClose)
  busyRef.current = busy; closeRef.current = onClose
  const isRequest = operation === 'request'
  const reason = uncertainReason ?? (isRequest && choice && choice !== 'other' ? i18n.t(`ui.orderCancel.reason.${choice}`) : customReason.trim())
  const valid = (decisionChoice === undefined || decisionChoice !== null) && (operation === 'forward' || reason.length >= 3 && reason.length <= 500)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])
    ;(controls().find((element) => element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') ?? controls()[0])?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busyRef.current) closeRef.current(); return }
      if (event.key !== 'Tab') return
      const focusable = controls()
      if (!focusable.length) { event.preventDefault(); return }
      const first = focusable[0]; const last = focusable[focusable.length - 1]
      if (!focusable.includes(document.activeElement as HTMLElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus() }
  }, [])

  return createPortal(<div className="modal-backdrop reservation-action-backdrop" role="presentation">
    <section ref={dialogRef} className="reservation-action-dialog cancellation-request-dialog" role="dialog" aria-modal="true" aria-labelledby="cancellation-request-title" aria-describedby="cancellation-request-description">
      <header className="reservation-action-dialog-header"><div className="reservation-action-dialog-icon" aria-hidden="true"><AlertCircle size={20} /></div><button className="reservation-action-dialog-close" type="button" aria-label={i18n.t('ui.common.close')} disabled={busy} onClick={onClose}><X size={18} /></button></header>
      <div className="reservation-action-dialog-body">
        <h2 id="cancellation-request-title">{i18n.t(decisionChoice === null ? 'ui.cancellationRequest.title.review' : `ui.cancellationRequest.title.${operation}`, { id: order.id })}</h2>
        <p id="cancellation-request-description">{i18n.t(decisionChoice === null ? 'ui.cancellationRequest.description.review' : `ui.cancellationRequest.description.${operation}`)}</p>
        <ul className="cancellation-request-products">{order.items.map((item, index) => <li key={`${item.name}:${index}`}>{item.quantity} × {item.name}</li>)}</ul>
        {order.cancellationRequest ? <CancellationRequestInfo request={order.cancellationRequest} /> : null}
        {onDecisionChoice && !uncertainReason ? <div className="cancellation-request-choice" role="group" aria-label={i18n.t('ui.cancellationRequest.chooseDecision')}><button type="button" aria-pressed={decisionChoice === 'approve'} disabled={busy} onClick={() => onDecisionChoice('approve')}>{i18n.t('ui.cancellationRequest.confirm.approve')}</button><button type="button" aria-pressed={decisionChoice === 'reject'} disabled={busy} onClick={() => onDecisionChoice('reject')}>{i18n.t('ui.cancellationRequest.confirm.reject')}</button></div> : null}
        {uncertainReason !== null ? <p className="cancellation-request-locked">{i18n.t('ui.cancellationRequest.sameReason')} <strong>{uncertainReason}</strong></p>
          : operation === 'forward' ? null
            : <>{isRequest ? <label className="order-cancel-field" htmlFor="cancellation-request-choice">{i18n.t('ui.cancellationRequest.requestReason')}<select id="cancellation-request-choice" value={choice} disabled={busy} onChange={(event) => setChoice(event.target.value)}><option value="">{i18n.t('ui.orderCancel.chooseReason')}</option><option value="planChanged">{i18n.t('ui.orderCancel.reason.planChanged')}</option><option value="orderedByMistake">{i18n.t('ui.orderCancel.reason.orderedByMistake')}</option><option value="noLongerNeeded">{i18n.t('ui.orderCancel.reason.noLongerNeeded')}</option><option value="other">{i18n.t('ui.orderCancel.reason.other')}</option></select></label> : null}
              {(!isRequest && (decisionChoice === undefined || decisionChoice !== null) || choice === 'other') ? <label className="order-cancel-field" htmlFor="cancellation-request-reason">{i18n.t(isRequest ? 'ui.orderCancel.otherReason' : 'ui.cancellationRequest.decisionReason')}<textarea id="cancellation-request-reason" value={customReason} disabled={busy} maxLength={500} rows={3} onChange={(event) => setCustomReason(event.target.value)} /></label> : null}</>}
        {error ? <p className="order-cancel-error" role="alert">{error}</p> : null}
      </div>
      <footer className="reservation-action-dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>{i18n.t('ui.common.close')}</Button><Button type="button" variant={operation === 'approve' && decisionChoice === 'approve' ? 'danger' : 'primary'} disabled={busy || !valid} onClick={() => onConfirm(reason)}>{busy ? i18n.t('ui.cancellationRequest.wait') : uncertainReason !== null ? i18n.t('ui.orderCancel.retry') : decisionChoice === null ? i18n.t('ui.cancellationRequest.chooseDecision') : i18n.t(`ui.cancellationRequest.confirm.${operation}`)}</Button></footer>
    </section>
  </div>, document.body)
}
