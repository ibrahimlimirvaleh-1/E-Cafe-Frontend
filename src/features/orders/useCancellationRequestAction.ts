import { useEffect, useRef, useState } from 'react'
import type { CancellationStockReturnSelection, OrderCancellationRequestResponse, StockReturnEntry } from '../../shared/api/ecafeApi'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import { i18n } from '../../shared/i18n/i18n'
import { cancellationRequestStatus } from './cancellationRequest'
import { parseStockReturnQuantity } from './stockReturnQuantity'

export type CancellationOperation = 'request' | 'forward' | 'approve' | 'reject'
export type RequestableOrder = {
  id: number
  cancellationRequest: OrderCancellationRequestResponse | null
  canRequestCancellation?: boolean
  canForwardCancellationRequest?: boolean
  canDecideCancellationRequest?: boolean
  stockReturns?: StockReturnEntry[] | null
}
type Intent<T> = { scope: string; order: T; operation: CancellationOperation; reason: string | null; stockReturn: CancellationStockReturnSelection | null; uncertain: boolean; visible: boolean }

function matchesStockReturn(order: RequestableOrder, selection: CancellationStockReturnSelection | null) {
  if (!selection || !order.cancellationRequest) return false
  const request = order.cancellationRequest
  const mode = request.stockReturnMode ?? (request.ingredientsUnused === true ? 2 : request.ingredientsUnused === false ? 1 : null)
  if (mode !== selection.mode) return false
  if (mode !== 3) return true
  if (!order.stockReturns || order.stockReturns.length !== selection.stockReturns.length) return false
  const byId = (left: StockReturnEntry, right: StockReturnEntry) => left.inventoryItemId - right.inventoryItemId
  const saved = [...order.stockReturns].sort(byId)
  const intended = [...selection.stockReturns].sort(byId)
  return saved.every((row, index) => row.inventoryItemId === intended[index].inventoryItemId && parseStockReturnQuantity(row.returnQuantity) === intended[index].returnQuantity)
}

function completed(order: RequestableOrder, operation: CancellationOperation, priorRequestId: number | null, reason: string, stockReturn: CancellationStockReturnSelection | null) {
  const request = order.cancellationRequest
  if (!request) return false
  if (operation === 'request') return priorRequestId === null && request.id > 0 && request.reason === reason && request.statusId !== cancellationRequestStatus.expired
  if (request.id !== priorRequestId) return false
  if (operation === 'forward') return request.statusId === cancellationRequestStatus.pendingKitchen || request.statusId === cancellationRequestStatus.approved || request.statusId === cancellationRequestStatus.rejected
  return operation === 'approve'
    ? request.statusId === cancellationRequestStatus.approved && request.decisionReason === reason && matchesStockReturn(order, stockReturn)
    : request.statusId === cancellationRequestStatus.rejected && request.decisionReason === reason
}

function conflicted(order: RequestableOrder, operation: CancellationOperation, priorRequestId: number | null, reason: string, stockReturn: CancellationStockReturnSelection | null) {
  const request = order.cancellationRequest
  if (operation === 'request') return Boolean(request && (request.reason !== reason || request.statusId === cancellationRequestStatus.expired)) || !request && order.canRequestCancellation === false
  if (!request || request.id !== priorRequestId || request.statusId === cancellationRequestStatus.expired) return true
  if (operation === 'forward') return request.statusId === cancellationRequestStatus.awaitingWaiter && order.canForwardCancellationRequest === false
  const oppositeStatus = operation === 'approve' ? cancellationRequestStatus.rejected : cancellationRequestStatus.approved
  return request.statusId === oppositeStatus || request.statusId === cancellationRequestStatus.approved && (!matchesStockReturn(order, stockReturn) || request.decisionReason !== reason) || request.statusId !== cancellationRequestStatus.pendingKitchen || order.canDecideCancellationRequest === false
}

export function useCancellationRequestAction<T extends RequestableOrder>(
  scope: string,
  post: (orderId: number, operation: CancellationOperation, reason: string, stockReturn: CancellationStockReturnSelection | null) => Promise<T>,
  getOrder: (orderId: number) => Promise<T>,
  onComplete: (order: T, operation: CancellationOperation) => void,
  revalidate: () => void,
) {
  const [intent, setIntent] = useState<Intent<T> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState<'success' | 'warning'>('success')
  const scopeRef = useRef(scope)
  const generationRef = useRef(0)
  const noticeScopeRef = useRef(scope)
  const inFlightRef = useRef<symbol | null>(null)
  const mountedRef = useRef(true)
  scopeRef.current = scope

  useEffect(() => {
    generationRef.current += 1
    setIntent(null); setBusy(false); setError(''); setNotice(''); inFlightRef.current = null
  }, [scope])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  function open(order: T, operation: CancellationOperation) {
    if (inFlightRef.current || intent?.scope === scope && intent.uncertain && (intent.order.id !== order.id || intent.operation !== operation)) return
    setIntent((current) => current?.scope === scope && current.uncertain && current.order.id === order.id && current.operation === operation
      ? { ...current, visible: true }
      : { scope, order, operation, reason: null, stockReturn: null, uncertain: false, visible: true })
    setError(''); setNotice('')
  }

  function close() {
    if (inFlightRef.current) return
    setIntent((current) => current?.uncertain ? { ...current, visible: false } : null)
    setError('')
  }

  async function submit(rawReason = '', rawStockReturn: CancellationStockReturnSelection | null = null) {
    const currentIntent = intent
    if (!currentIntent || currentIntent.scope !== scope || inFlightRef.current) return
    const { order, operation } = currentIntent
    const reason = currentIntent.uncertain ? currentIntent.reason ?? '' : rawReason.trim()
    const stockReturn = currentIntent.uncertain ? currentIntent.stockReturn : operation === 'approve' && rawStockReturn ? {
      mode: rawStockReturn.mode,
      stockReturns: rawStockReturn.stockReturns.map((entry) => ({ ...entry })).sort((left, right) => left.inventoryItemId - right.inventoryItemId),
    } : null
    if (operation !== 'forward' && (reason.length < 3 || reason.length > 500)) return
    if (operation === 'approve' && stockReturn === null) return
    const priorRequestId = order.cancellationRequest?.id ?? null
    const requestScope = scope
    const requestGeneration = generationRef.current
    const isCurrent = () => mountedRef.current && scopeRef.current === requestScope && generationRef.current === requestGeneration
    const runToken = Symbol('cancellation-request')
    inFlightRef.current = runToken
    setBusy(true); setError(''); setNotice('')

    function finish(updated: T) {
      if (!isCurrent()) return
      setIntent(null)
      noticeScopeRef.current = requestScope
      setNoticeTone('success')
      setNotice(i18n.t(`ui.cancellationRequest.success.${operation}`, { id: order.id }))
      onComplete(updated, operation)
    }

    try {
      const updated = await post(order.id, operation, reason, stockReturn)
      if (updated.id !== order.id || !completed(updated, operation, priorRequestId, reason, stockReturn)) throw new Error('Unexpected cancellation request response')
      finish(updated)
    } catch (caught) {
      if (!isCurrent()) return
      if (caught instanceof ApiError && [400, 422].includes(caught.statusCode)) {
        setError(normalizeCaughtApiError(caught, i18n.t('ui.cancellationRequest.failed')).message)
      } else if (caught instanceof ApiError && caught.statusCode === 409 && ['OrderStockReturnInvalid', 'OrderStockReturnQuantitiesInvalid'].includes(caught.code ?? '')) {
        setError(normalizeCaughtApiError(caught, i18n.t('ui.cancellationRequest.failed')).message)
        revalidate()
      } else if (caught instanceof ApiError && [403, 404].includes(caught.statusCode)) {
        setIntent(null)
        noticeScopeRef.current = requestScope
        setNoticeTone('warning'); setNotice(i18n.t('ui.cancellationRequest.accessLost'))
        revalidate()
      } else {
        try {
          const latest = await getOrder(order.id)
          if (!isCurrent()) return
          if (latest.id === order.id && completed(latest, operation, priorRequestId, reason, stockReturn)) {
            finish(latest)
          } else if (caught instanceof ApiError && caught.statusCode === 409 || latest.id !== order.id || conflicted(latest, operation, priorRequestId, reason, stockReturn)) {
            setIntent(null)
            noticeScopeRef.current = requestScope
            setNoticeTone('warning'); setNotice(i18n.t('ui.cancellationRequest.conflict'))
            revalidate()
          } else {
            setIntent({ ...currentIntent, order: latest, reason, stockReturn, uncertain: true })
            setError(i18n.t('ui.cancellationRequest.uncertain'))
            revalidate()
          }
        } catch {
          if (!isCurrent()) return
          if (caught instanceof ApiError && caught.statusCode === 409) {
            setIntent(null)
            noticeScopeRef.current = requestScope
            setNoticeTone('warning'); setNotice(i18n.t('ui.cancellationRequest.conflict'))
          } else {
            setIntent({ ...currentIntent, reason, stockReturn, uncertain: true })
            setError(i18n.t('ui.cancellationRequest.uncertain'))
          }
          revalidate()
        }
      }
    } finally {
      if (inFlightRef.current === runToken) inFlightRef.current = null
      if (isCurrent()) setBusy(false)
    }
  }

  function reconcile(order: T | null) {
    if (busy || intent?.scope !== scope || !intent.uncertain || !order || order.id !== intent.order.id) return
    if (completed(order, intent.operation, intent.order.cancellationRequest?.id ?? null, intent.reason ?? '', intent.stockReturn)) {
      setIntent(null); setError('')
      noticeScopeRef.current = scope
      setNoticeTone('success'); setNotice(i18n.t(`ui.cancellationRequest.success.${intent.operation}`, { id: order.id }))
      onComplete(order, intent.operation)
    } else if (conflicted(order, intent.operation, intent.order.cancellationRequest?.id ?? null, intent.reason ?? '', intent.stockReturn)) {
      setIntent(null); setError('')
      noticeScopeRef.current = scope
      setNoticeTone('warning'); setNotice(i18n.t('ui.cancellationRequest.conflict'))
    }
  }

  return { intent: intent?.scope === scope ? intent : null, busy, error, notice: noticeScopeRef.current === scope ? notice : '', noticeTone, open, close, submit, reconcile }
}
