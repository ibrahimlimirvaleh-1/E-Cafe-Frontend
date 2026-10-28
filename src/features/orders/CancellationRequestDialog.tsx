import { AlertCircle, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CancellationStockReturnSelection, KitchenStockReturnPreview, StockReturnMode } from '../../shared/api/ecafeApi'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import { i18n } from '../../shared/i18n/i18n'
import { inventoryUnitLabel } from '../../shared/lib/inventoryFormatting'
import { Button } from '../../shared/ui/Button'
import type { CancellationOperation, RequestableOrder } from './useCancellationRequestAction'
import { CancellationRequestInfo } from './CancellationRequestInfo'
import { parseStockReturnQuantity, remainingStockQuantity, scaledStockQuantity } from './stockReturnQuantity'
import './cancellation-request.css'

type Props = {
  order: RequestableOrder & { items: { name: string; quantity: number }[] }
  operation: CancellationOperation
  busy: boolean
  error: string
  uncertainReason: string | null
  onClose: () => void
  onConfirm: (reason: string, selection: CancellationStockReturnSelection | null) => void
  decisionChoice?: 'approve' | 'reject' | null
  onDecisionChoice?: (choice: 'approve' | 'reject') => void
  restaurantId?: string
  lockedStockReturn?: CancellationStockReturnSelection | null
}

type PreviewState = { scope: string; data: KitchenStockReturnPreview | null; error: string; loading: boolean }
type Validation = { target: 'decision' | 'reason' | 'mode' | 'preview' | number; message: string } | null

const stockModes = [1, 2, 3] as const
const modeKeys = {
  1: 'used', 2: 'unused', 3: 'perIngredient',
} as const

export function CancellationRequestDialog({ order, operation, busy, error, uncertainReason, onClose, onConfirm, decisionChoice, onDecisionChoice, restaurantId, lockedStockReturn = null }: Props) {
  const [choice, setChoice] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [mode, setMode] = useState<StockReturnMode | null>(null)
  const [returnInputs, setReturnInputs] = useState<Record<number, string>>({})
  const [previewRetry, setPreviewRetry] = useState(0)
  const [previewState, setPreviewState] = useState<PreviewState>({ scope: '', data: null, error: '', loading: false })
  const [validation, setValidation] = useState<Validation>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const reasonRef = useRef<HTMLTextAreaElement | HTMLSelectElement | null>(null)
  const modeRef = useRef<HTMLFieldSetElement | null>(null)
  const decisionRef = useRef<HTMLDivElement | null>(null)
  const previewRetryRef = useRef<HTMLButtonElement | null>(null)
  const inputRefs = useRef(new Map<number, HTMLInputElement>())
  const busyRef = useRef(busy)
  const closeRef = useRef(onClose)
  busyRef.current = busy
  closeRef.current = onClose

  const isRequest = operation === 'request'
  const isApproval = operation === 'approve' && decisionChoice === 'approve'
  const isLocked = uncertainReason !== null
  const selectedMode = isLocked ? lockedStockReturn?.mode ?? null : mode
  const reason = uncertainReason ?? (isRequest && choice && choice !== 'other' ? i18n.t(`ui.orderCancel.reason.${choice}`) : customReason.trim())
  const needsPreview = isApproval && !isLocked && (mode === 2 || mode === 3)
  const previewScope = `${restaurantId ?? ''}:${order.id}:${mode ?? ''}:${previewRetry}`
  const preview = previewState.scope === previewScope ? previewState : null

  useEffect(() => {
    if (!needsPreview || !restaurantId) return
    const controller = new AbortController()
    setPreviewState({ scope: previewScope, data: null, error: '', loading: true })
    void ecafeApi.kitchen.getCancellationStockReturn(restaurantId, order.id, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setReturnInputs({})
        setPreviewState({ scope: previewScope, data, error: '', loading: false })
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        const fallback = i18n.t('ui.partialStockReturn.previewFailed')
        setPreviewState({ scope: previewScope, data: null, error: caught instanceof ApiError ? normalizeCaughtApiError(caught, fallback).message : fallback, loading: false })
      })
    return () => controller.abort()
  }, [needsPreview, restaurantId, order.id, mode, previewRetry, previewScope])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), input:not(:disabled)') ?? [])
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

  function showValidation(target: NonNullable<Validation>['target'], message: string) {
    setValidation({ target, message })
    window.requestAnimationFrame(() => {
      const field = target === 'decision' ? decisionRef.current?.querySelector<HTMLElement>('button')
        : target === 'reason' ? reasonRef.current
          : target === 'mode' ? modeRef.current?.querySelector<HTMLElement>('input')
            : target === 'preview' ? previewRetryRef.current
              : inputRefs.current.get(target)
      field?.focus()
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  function confirm() {
    if (busy) return
    if (isLocked) { onConfirm(reason, lockedStockReturn); return }
    if (decisionChoice === null) { showValidation('decision', i18n.t('ui.cancellationRequest.chooseDecision')); return }
    if (operation !== 'forward' && (reason.length < 3 || reason.length > 500)) { showValidation('reason', i18n.t('ui.partialStockReturn.reasonRequired')); return }
    if (!isApproval) { onConfirm(reason, null); return }
    if (mode === null) { showValidation('mode', i18n.t('ui.partialStockReturn.modeRequired')); return }
    if (mode === 1) { onConfirm(reason, { mode, stockReturns: [] }); return }
    if (!preview?.data || preview.error || preview.loading) { showValidation('preview', preview?.error || i18n.t('ui.partialStockReturn.previewLoading')); return }
    if (mode === 2) { onConfirm(reason, { mode, stockReturns: [] }); return }
    const rows = preview.data.ingredients
    if (!rows.length) { showValidation('preview', i18n.t('ui.partialStockReturn.noIngredients')); return }
    const stockReturns = []
    for (const row of rows) {
      const raw = returnInputs[row.inventoryItemId] ?? ''
      const quantity = parseStockReturnQuantity(raw)
      if (quantity === null) { showValidation(row.inventoryItemId, i18n.t('ui.partialStockReturn.enterQuantity')); return }
      if (scaledStockQuantity(quantity) > scaledStockQuantity(row.consumedQuantity)) { showValidation(row.inventoryItemId, i18n.t('ui.partialStockReturn.exceedsConsumed')); return }
      stockReturns.push({ inventoryItemId: row.inventoryItemId, returnQuantity: quantity })
    }
    onConfirm(reason, { mode, stockReturns })
  }

  return createPortal(<div className="modal-backdrop reservation-action-backdrop" role="presentation">
    <section ref={dialogRef} className={`reservation-action-dialog cancellation-request-dialog${onDecisionChoice ? ' is-kitchen-decision' : ''}`} role="dialog" aria-modal="true" aria-labelledby="cancellation-request-title" aria-describedby="cancellation-request-description">
      <header className="reservation-action-dialog-header"><div className="reservation-action-dialog-icon" aria-hidden="true"><AlertCircle size={20} /></div><h2 id="cancellation-request-title">{i18n.t(decisionChoice === null ? 'ui.cancellationRequest.title.review' : `ui.cancellationRequest.title.${operation}`, { id: order.id })}</h2><button className="reservation-action-dialog-close" type="button" aria-label={i18n.t('ui.common.close')} disabled={busy} onClick={onClose}><X size={18} /></button></header>
      <div className="reservation-action-dialog-body">
        <p id="cancellation-request-description">{i18n.t(decisionChoice === null ? 'ui.cancellationRequest.description.review' : operation === 'approve' ? 'ui.cancellationRequest.description.approveWithStockReturn' : `ui.cancellationRequest.description.${operation}`)}</p>
        {order.cancellationRequest && onDecisionChoice ? <p className="cancellation-request-summary"><strong>{i18n.t('ui.cancellationRequest.requestReason')}:</strong> {order.cancellationRequest.reason}</p> : null}
        {onDecisionChoice && !isLocked ? <div ref={decisionRef} className="cancellation-request-choice" role="group" aria-label={i18n.t('ui.cancellationRequest.chooseDecision')}><button type="button" aria-pressed={decisionChoice === 'approve'} disabled={busy} onClick={() => { setMode(null); setReturnInputs({}); setValidation(null); onDecisionChoice('approve') }}>{i18n.t('ui.cancellationRequest.confirm.approve')}</button><button type="button" aria-pressed={decisionChoice === 'reject'} disabled={busy} onClick={() => { setMode(null); setReturnInputs({}); setValidation(null); onDecisionChoice('reject') }}>{i18n.t('ui.cancellationRequest.confirm.reject')}</button></div> : null}
        {validation?.target === 'decision' ? <p className="order-cancel-error" role="alert">{validation.message}</p> : null}
        {isLocked ? <p className="cancellation-request-locked">{i18n.t('ui.cancellationRequest.sameReason')} <strong>{uncertainReason}</strong></p>
          : operation === 'forward' ? null
            : <>{isRequest ? <label className="order-cancel-field" htmlFor="cancellation-request-choice">{i18n.t('ui.cancellationRequest.requestReason')}<select ref={reasonRef as React.Ref<HTMLSelectElement>} id="cancellation-request-choice" value={choice} disabled={busy} onChange={(event) => { setChoice(event.target.value); setValidation(null) }}><option value="">{i18n.t('ui.orderCancel.chooseReason')}</option><option value="planChanged">{i18n.t('ui.orderCancel.reason.planChanged')}</option><option value="orderedByMistake">{i18n.t('ui.orderCancel.reason.orderedByMistake')}</option><option value="noLongerNeeded">{i18n.t('ui.orderCancel.reason.noLongerNeeded')}</option><option value="other">{i18n.t('ui.orderCancel.reason.other')}</option></select></label> : null}
              {(!isRequest && (decisionChoice === undefined || decisionChoice !== null) || choice === 'other') ? <label className="order-cancel-field" htmlFor="cancellation-request-reason">{i18n.t(isRequest ? 'ui.orderCancel.otherReason' : 'ui.cancellationRequest.decisionReason')}<textarea ref={reasonRef as React.Ref<HTMLTextAreaElement>} id="cancellation-request-reason" value={customReason} disabled={busy} maxLength={500} rows={3} onChange={(event) => { setCustomReason(event.target.value); setValidation(null) }} /></label> : null}</>}
        {validation?.target === 'reason' ? <p className="order-cancel-error" role="alert">{validation.message}</p> : null}
        {error ? <p className="order-cancel-error" role="alert">{error}</p> : null}
        {isApproval ? isLocked
          ? <p className="cancellation-request-locked">{i18n.t('ui.cancellationRequest.ingredientChoiceLocked')} <strong>{selectedMode ? i18n.t(`ui.partialStockReturn.mode.${modeKeys[selectedMode]}`) : ''}</strong>{selectedMode === 3 ? <small>{i18n.t('ui.partialStockReturn.lockedCount', { count: lockedStockReturn?.stockReturns.length ?? 0 })}</small> : null}</p>
          : <fieldset ref={modeRef} className="cancellation-request-ingredients"><legend>{i18n.t('ui.partialStockReturn.question')}</legend><div className="cancellation-request-ingredients-options">{stockModes.map((stockMode) => <label key={stockMode}><input type="radio" name="stockReturnMode" checked={mode === stockMode} disabled={busy} onChange={() => { setMode(stockMode); setReturnInputs({}); setValidation(null) }} /><span><strong>{i18n.t(`ui.partialStockReturn.mode.${modeKeys[stockMode]}`)}</strong><small>{i18n.t(`ui.partialStockReturn.hint.${modeKeys[stockMode]}`)}</small></span></label>)}</div></fieldset> : null}
        {validation?.target === 'mode' ? <p className="order-cancel-error" role="alert">{validation.message}</p> : null}
        {needsPreview ? <section className="cancellation-stock-preview" aria-label={i18n.t('ui.partialStockReturn.previewTitle')}>
          {preview?.loading || !preview ? <p role="status">{i18n.t('ui.partialStockReturn.previewLoading')}</p> : null}
          {preview?.error ? <div className="cancellation-stock-preview-error"><p role="alert">{preview.error}</p><button ref={previewRetryRef} className="ui-button ui-button-secondary" type="button" onClick={() => { setValidation(null); setPreviewRetry((value) => value + 1) }}><RefreshCw size={16} />{i18n.t('ui.partialStockReturn.retryPreview')}</button></div> : null}
          {validation?.target === 'preview' && !preview?.error ? <p className="order-cancel-error" role="alert">{validation.message}</p> : null}
          {preview?.data && mode === 2 ? <div className="cancellation-stock-summary"><strong>{i18n.t('ui.partialStockReturn.fullReturn')}</strong>{preview.data.ingredients.length ? <ul>{preview.data.ingredients.map((ingredient) => <li key={ingredient.inventoryItemId}><span>{ingredient.name}</span><strong>{ingredient.consumedQuantity} {inventoryUnitLabel(ingredient.unitCode, ingredient.unitName)}</strong></li>)}</ul> : <p>{i18n.t('ui.partialStockReturn.noIngredients')}</p>}</div> : null}
          {preview?.data && mode === 3 ? <div className="cancellation-stock-grid"><div className="cancellation-stock-grid-head" aria-hidden="true"><span>{i18n.t('ui.partialStockReturn.ingredient')}</span><span>{i18n.t('ui.partialStockReturn.consumed')}</span><span>{i18n.t('ui.partialStockReturn.return')}</span><span>{i18n.t('ui.partialStockReturn.usedOrLost')}</span></div>{preview.data.ingredients.map((ingredient) => {
            const raw = returnInputs[ingredient.inventoryItemId] ?? ''
            const parsed = parseStockReturnQuantity(raw)
            const validQuantity = parsed !== null && scaledStockQuantity(parsed) <= scaledStockQuantity(ingredient.consumedQuantity)
            const unit = inventoryUnitLabel(ingredient.unitCode, ingredient.unitName)
            return <div className="cancellation-stock-row" key={ingredient.inventoryItemId}><strong className="cancellation-stock-name">{ingredient.name}</strong><span data-label={i18n.t('ui.partialStockReturn.consumed')}>{ingredient.consumedQuantity} {unit}</span><label data-label={i18n.t('ui.partialStockReturn.return')}><input ref={(element) => { if (element) inputRefs.current.set(ingredient.inventoryItemId, element); else inputRefs.current.delete(ingredient.inventoryItemId) }} type="text" inputMode="decimal" autoComplete="off" value={raw} disabled={busy} aria-label={i18n.t('ui.partialStockReturn.returnFor', { name: ingredient.name })} aria-invalid={validation?.target === ingredient.inventoryItemId} onChange={(event) => { setReturnInputs((current) => ({ ...current, [ingredient.inventoryItemId]: event.target.value })); setValidation(null) }} /><small>{unit}</small></label><span data-label={i18n.t('ui.partialStockReturn.usedOrLost')}>{validQuantity ? `${remainingStockQuantity(ingredient.consumedQuantity, parsed)} ${unit}` : i18n.t('ui.partialStockReturn.awaitingQuantity')}</span>{validation?.target === ingredient.inventoryItemId ? <small className="order-cancel-error cancellation-stock-row-error" role="alert">{validation.message}</small> : null}</div>
          })}</div> : null}
        </section> : null}
        <ul className="cancellation-request-products">{order.items.map((item, index) => <li key={`${item.name}:${index}`}>{item.quantity} × {item.name}</li>)}</ul>
        {order.cancellationRequest ? <CancellationRequestInfo request={order.cancellationRequest} /> : null}
      </div>
      <footer className="reservation-action-dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>{i18n.t('ui.common.close')}</Button><Button type="button" variant={isApproval ? 'danger' : 'primary'} disabled={busy} onClick={confirm}>{busy ? i18n.t('ui.cancellationRequest.wait') : isLocked ? i18n.t('ui.orderCancel.retry') : decisionChoice === null ? i18n.t('ui.cancellationRequest.chooseDecision') : i18n.t(`ui.cancellationRequest.confirm.${operation}`)}</Button></footer>
    </section>
  </div>, document.body)
}
