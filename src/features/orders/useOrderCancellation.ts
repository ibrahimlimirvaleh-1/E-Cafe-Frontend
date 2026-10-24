import { useEffect, useRef, useState } from 'react'
import { ApiError, normalizeCaughtApiError } from '../../shared/api/httpClient'
import { i18n } from '../../shared/i18n/i18n'
import { orderStatusId } from '../../shared/lib/orderStatus'

export type CancellableOrder = {
  id: number
  statusId: number
  canCancel: boolean
  cancelledAt: string | null
  cancellationReason: string | null
  subtotal: number
  items: { name: string; quantity: number }[]
}

type Intent<T> = { scope: string; order: T; tableName: string; visible: boolean; uncertainReason: string | null }

function conflictMessage(error: ApiError) {
  if (error.code === 'SessionBillPaymentPending') return i18n.t('ui.orderCancel.pendingPayment')
  if (error.code === 'SessionBillInvalid') return i18n.t('ui.orderCancel.billReview')
  if (error.code === 'OrderCancellationStockConflict') return i18n.t('ui.orderCancel.stockConflict')
  if (error.code === 'OrderCannotCancel') return i18n.t('ui.orderCancel.unavailable')
  return normalizeCaughtApiError(error, i18n.t('ui.orderCancel.unavailable')).message
}

export function useOrderCancellation<T extends CancellableOrder>(
  scope: string,
  request: (orderId: number, reason: string) => Promise<T>,
  getOrder: (orderId: number) => Promise<T>,
  onComplete: (order: T) => void,
  revalidate: () => void,
) {
  const [intent, setIntent] = useState<Intent<T> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState<'success' | 'warning'>('success')
  const noticeScopeRef = useRef(scope)
  const scopeRef = useRef(scope)
  const inFlightRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  scopeRef.current = scope

  useEffect(() => {
    setIntent(null)
    setBusy(false)
    setError('')
    setNotice('')
    setNoticeTone('success')
    inFlightRef.current = null
  }, [scope])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  function open(order: T, tableName: string) {
    if (inFlightRef.current === scope) return
    if (intent?.scope === scope && intent.uncertainReason && intent.order.id !== order.id) return
    if (!order.canCancel && !(intent?.scope === scope && intent.uncertainReason && intent.order.id === order.id)) return
    setIntent((current) => current?.scope === scope && current.uncertainReason && current.order.id === order.id
      ? { ...current, visible: true }
      : { scope, order, tableName, visible: true, uncertainReason: null })
    setError('')
    setNotice('')
    setNoticeTone('success')
  }

  function close() {
    if (inFlightRef.current === scope) return
    setIntent((current) => current?.uncertainReason ? { ...current, visible: false } : null)
    setError('')
  }

  async function submit(rawReason: string) {
    if (!intent || intent.scope !== scope || inFlightRef.current === scope) return
    const reason = intent.uncertainReason ?? rawReason.trim()
    if (reason.length < 3 || reason.length > 500 || (!intent.order.canCancel && !intent.uncertainReason)) return
    const requestScope = scope
    const orderId = intent.order.id
    const isCurrent = () => mountedRef.current && scopeRef.current === requestScope
    inFlightRef.current = requestScope
    setBusy(true)
    setError('')
    setNotice('')

    const complete = (order: T) => {
      if (!isCurrent()) return
      setIntent(null)
      noticeScopeRef.current = requestScope
      setNotice(i18n.t('ui.orderCancel.success', { id: orderId }))
      setNoticeTone('success')
      onComplete(order)
    }

    try {
      const updated = await request(orderId, reason)
      if (updated.id !== orderId || updated.statusId !== orderStatusId.cancelled) throw new Error('Unexpected cancellation response')
      complete(updated)
    } catch (caught) {
      if (!isCurrent()) return
      const known = caught instanceof ApiError && [400, 403, 404, 409, 422].includes(caught.statusCode)
      if (known && caught.statusCode !== 409) {
        if (caught.statusCode === 403 || caught.statusCode === 404) {
          setIntent(null)
          noticeScopeRef.current = requestScope
          setNotice(i18n.t('ui.orderCancel.accessLost'))
          setNoticeTone('warning')
          revalidate()
        } else {
          setError(normalizeCaughtApiError(caught, i18n.t('ui.orderCancel.failed')).message)
        }
      } else {
        try {
          const current = await getOrder(orderId)
          if (!isCurrent()) return
          if (current.id === orderId && current.statusId === orderStatusId.cancelled) {
            complete(current)
          } else if (caught instanceof ApiError && caught.statusCode === 409 || current.id !== orderId || !current.canCancel) {
            setIntent(null)
            noticeScopeRef.current = requestScope
            setNotice(caught instanceof ApiError && caught.statusCode === 409
              ? conflictMessage(caught)
              : i18n.t('ui.orderCancel.unavailable'))
            setNoticeTone('warning')
            revalidate()
          } else {
            setIntent((previous) => previous?.order.id === orderId
              ? { ...previous, order: current, uncertainReason: reason }
              : previous)
            setError(i18n.t('ui.orderCancel.uncertain'))
            revalidate()
          }
        } catch {
          if (!isCurrent()) return
          if (caught instanceof ApiError && caught.statusCode === 409) {
            setIntent(null)
            noticeScopeRef.current = requestScope
            setNotice(conflictMessage(caught))
            setNoticeTone('warning')
          } else {
            setIntent((previous) => previous?.order.id === orderId ? { ...previous, uncertainReason: reason } : previous)
            setError(i18n.t('ui.orderCancel.uncertain'))
          }
          revalidate()
        }
      }
    } finally {
      if (inFlightRef.current === requestScope) inFlightRef.current = null
      if (isCurrent()) setBusy(false)
    }
  }

  function reconcile(order: T | null) {
    if (busy || intent?.scope !== scope || !intent.uncertainReason || !order || order.id !== intent.order.id) return
    if (order.statusId === orderStatusId.cancelled) {
      setIntent(null)
      setError('')
      noticeScopeRef.current = scope
      setNotice(i18n.t('ui.orderCancel.success', { id: order.id }))
      setNoticeTone('success')
      onComplete(order)
    } else if (!order.canCancel) {
      setIntent(null)
      setError('')
      noticeScopeRef.current = scope
      setNotice(i18n.t('ui.orderCancel.unavailable'))
      setNoticeTone('warning')
    }
  }

  return { intent: intent?.scope === scope ? intent : null, busy, error, notice: noticeScopeRef.current === scope ? notice : '', noticeTone, open, close, submit, reconcile }
}
