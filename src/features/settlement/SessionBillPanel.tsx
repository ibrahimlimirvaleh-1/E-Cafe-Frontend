import { i18n } from '../../shared/i18n/i18n'
import { CreditCard, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ecafeApi, type SessionBillResponse } from '../../shared/api/ecafeApi'
import { normalizeCaughtApiError } from '../../shared/api/httpClient'
import { useAuth } from '../../shared/auth/AuthContext'
import { paymentStatusId, paymentStatusLabel } from '../../shared/lib/paymentStatus'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'
import './session-bill.css'

type Props = { sessionId: number; revision?: number; onBillChange?: (bill: SessionBillResponse | null) => void }
type CheckoutIntent = { key: string; previousPaymentId: number | null }
type TestOutcome = 'Succeeded' | 'Failed' | 'Cancelled' | 'Pending'

function money(amount: number, currency: string) {
  return `${amount.toFixed(2)} ${currency}`
}

function intentStorageKey(scope: string) {
  return `ecafe:session-bill-checkout:${scope}`
}

function getIntentKey(scope: string, previousPaymentId: number | null) {
  const storageKey = intentStorageKey(scope)
  const saved = window.sessionStorage.getItem(storageKey)
  if (saved) {
    try {
      const intent = JSON.parse(saved) as CheckoutIntent
      if (intent.key && intent.previousPaymentId === previousPaymentId) return intent.key
    } catch { /* A corrupt prior intent cannot be reused. */ }
  }
  const key = crypto.randomUUID()
  window.sessionStorage.setItem(storageKey, JSON.stringify({ key, previousPaymentId } satisfies CheckoutIntent))
  return key
}

export function SessionBillPanel({ sessionId, revision = 0, onBillChange }: Props) {
  const { user } = useAuth()
  const scope = `${user?.userId || ''}:${sessionId}`
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const onBillChangeRef = useRef(onBillChange)
  onBillChangeRef.current = onBillChange
  const requestIdRef = useRef(0)
  const previousRevisionRef = useRef(revision)
  const [bill, setBill] = useState<SessionBillResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [syncRequired, setSyncRequired] = useState(false)

  const loadBill = useCallback(async (quiet = false) => {
    const requestId = ++requestIdRef.current
    if (!quiet) setLoading(true)
    try {
      const result = await ecafeApi.tableSessions.getBill(sessionId)
      if (requestId === requestIdRef.current && scopeRef.current === scope) {
        setBill(result)
        setError('')
        setSyncRequired(false)
        onBillChangeRef.current?.(result)
      }
      return result
    } catch (cause) {
      if (requestId === requestIdRef.current && scopeRef.current === scope) {
        setError(normalizeCaughtApiError(cause, 'Hesab yüklənmədi.').message)
        onBillChangeRef.current?.(null)
      }
      throw cause
    } finally {
      if (requestId === requestIdRef.current && scopeRef.current === scope) setLoading(false)
    }
  }, [scope, sessionId])

  useEffect(() => {
    setBill(null)
    setError('')
    setFeedback('')
    setSyncRequired(false)
    onBillChangeRef.current?.(null)
    void loadBill().catch(() => {})
    return () => { requestIdRef.current++ }
  }, [loadBill])

  useEffect(() => {
    if (previousRevisionRef.current === revision) return
    previousRevisionRef.current = revision
    void loadBill(true).catch(() => {})
  }, [loadBill, revision])

  useEffect(() => {
    const refresh = () => { if (!document.hidden && !busy) void loadBill(true).catch(() => {}) }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('ecafe:notifications-refresh', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('ecafe:notifications-refresh', refresh)
    }
  }, [busy, loadBill])

  const payment = bill?.latestPayment
  const canAct = Boolean(bill && bill.isOpen && !payment?.requiresRefund && !loading && !busy && !error && !syncRequired)
  const canSimulate = Boolean(canAct && bill?.enabled && bill.isTest && payment?.isTest && payment.statusId === paymentStatusId.pending)

  async function checkout() {
    if (!canAct || !bill?.canPay || !bill.enabled) return
    setBusy(true)
    setFeedback('')
    let responseReceived = false
    try {
      const key = getIntentKey(scope, payment?.id ?? null)
      const created = await ecafeApi.tableSessions.checkoutBill(sessionId, key)
      responseReceived = true
      setSyncRequired(true)
      onBillChangeRef.current?.(null)
      await loadBill()
      window.sessionStorage.removeItem(intentStorageKey(scope))
      if (!created.isTest && created.checkoutUrl) {
        const url = new URL(created.checkoutUrl)
        if (url.protocol !== 'https:') throw new Error('Ödəniş ünvanı təhlükəsiz deyil.')
        window.location.assign(url.href)
      }
    } catch (cause) {
      setSyncRequired(true)
      onBillChangeRef.current?.(null)
      setFeedback(responseReceived
        ? 'Ödəniş yaradıldı, amma hesab yenidən yoxlanılmadı. Vəziyyəti yeniləyin; yeni ödəniş yaratmayın.'
        : normalizeCaughtApiError(cause, 'Ödənişin nəticəsi bilinmir. Eyni cəhdi təkrar yoxlayın.').message)
      if (!responseReceived) void loadBill(true).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  async function updatePayment(outcome?: TestOutcome) {
    if (!canAct || !payment || !bill || (outcome && !canSimulate)) return
    setBusy(true)
    setFeedback('')
    try {
      if (outcome) await ecafeApi.tableSessions.setBillTestOutcome(sessionId, payment.id, outcome)
      else await ecafeApi.tableSessions.refreshBillPayment(sessionId, payment.id)
      setSyncRequired(true)
      onBillChangeRef.current?.(null)
      await loadBill()
    } catch (cause) {
      setSyncRequired(true)
      onBillChangeRef.current?.(null)
      setFeedback(normalizeCaughtApiError(cause, 'Ödənişin vəziyyəti yoxlanılmadı.').message)
      void loadBill(true).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  return <section className="session-bill" aria-label={i18n.t('ui.features.settlement.session_bill_panel.masa_hesabi_2a4b3c')}>
    <div className="session-bill-heading"><div><span>{i18n.t('ui.features.settlement.session_bill_panel.yekun_hesab_5746c7')}</span><h3>{i18n.t('ui.features.settlement.session_bill_panel.masa_hesabi_2a4b3c')}</h3></div><Button type="button" variant="secondary" disabled={loading || busy} onClick={() => { setFeedback(''); void loadBill().catch(() => {}) }} aria-label={i18n.t('ui.features.settlement.session_bill_panel.hesabi_yenile_dd2ed6')} title={i18n.t('ui.features.settlement.session_bill_panel.hesabi_yenile_dd2ed6')}><RefreshCw size={17} /></Button></div>
    {loading && !bill ? <p role="status" className="session-bill-muted">{i18n.t('ui.features.settlement.session_bill_panel.hesab_yuklenir_d11ae9')}</p> : null}
    {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
    {bill ? <>
      <dl className="session-bill-amounts">
        <div><dt>{i18n.t('ui.features.settlement.session_bill_panel.sifarislerin_cemi_3f4438')}</dt><dd>{money(bill.totalAmount, bill.currencyCode)}</dd></div>
        <div><dt>{i18n.t('ui.features.settlement.session_bill_panel.depozit_krediti_594f24')}</dt><dd>{money(bill.depositCreditAmount, bill.currencyCode)}</dd></div>
        <div><dt>{i18n.t('ui.features.settlement.session_bill_panel.odenilmis_e025f3')}</dt><dd>{money(bill.paidAmount, bill.currencyCode)}</dd></div>
        <div className="session-bill-due"><dt>{i18n.t('ui.features.settlement.session_bill_panel.qaliq_c4a16a')}</dt><dd>{money(bill.remainingAmount, bill.currencyCode)}</dd></div>
      </dl>
      {payment?.requiresRefund ? <StatusMessage tone="warning" autoHideMs={false} dismissible={false}>{i18n.t('ui.features.settlement.session_bill_panel.bu_odenis_ayrica_yoxlanmalidir_yeni_od_081f52')}</StatusMessage> : null}
      {bill.isTest && !payment?.requiresRefund ? <StatusMessage tone="info" autoHideMs={false} dismissible={false}>{i18n.t('ui.features.settlement.session_bill_panel.test_rejimi_real_pul_tutulmur_ve_kart__27a345')}</StatusMessage> : null}
      {!bill.enabled && bill.remainingAmount > 0 ? <StatusMessage tone="warning" autoHideMs={false}>{i18n.t('ui.features.settlement.session_bill_panel.odenis_xidmeti_hazirda_elcatan_deyil_03e942')}</StatusMessage> : null}
      {bill.hasUnservedOrders ? <p className="session-bill-muted">{i18n.t('ui.features.settlement.session_bill_panel.hesablasma_ucun_evvel_aciq_sifarisler__67a45b')}</p> : null}
      {!bill.isOpen ? <p className="session-bill-muted">{i18n.t('ui.features.settlement.session_bill_panel.bu_sessiya_baglanib_hesab_yalniz_baxis_170d9a')}</p> : null}
      {payment ? <p className="session-bill-payment"><span>{i18n.t('ui.features.settlement.session_bill_panel.son_odenis_9f4fa3')}</span><strong>{paymentStatusLabel(payment.statusId, payment.status)}</strong><span>{money(payment.amount, payment.currencyCode)}</span></p> : null}
      {bill.isOpen && bill.remainingAmount <= 0 && !bill.hasUnservedOrders && !payment ? <p className="session-bill-muted"><ShieldCheck size={16} /> {i18n.t('ui.features.settlement.session_bill_panel.elave_odenis_teleb_olunmur_5491cb')}</p> : null}
      {feedback ? <StatusMessage tone="warning" autoHideMs={false}>{feedback}</StatusMessage> : null}
      {bill.isOpen && bill.enabled && !payment?.requiresRefund ? <div className="session-bill-actions">
        {bill.canPay ? <Button type="button" disabled={!canAct} onClick={() => void checkout()}><CreditCard size={17} />{busy ?i18n.t('ui.features.settlement.session_bill_panel.yoxlanilir_b497d3') : bill.isTest ?i18n.t('ui.features.settlement.session_bill_panel.test_odenisi_yarat_9b69ec') :i18n.t('ui.features.settlement.session_bill_panel.odenise_kec_3d18d4')}</Button> : null}
        {payment ? <Button type="button" variant="secondary" disabled={!canAct} onClick={() => void updatePayment()}><RefreshCw size={17} />{i18n.t('ui.features.settlement.session_bill_panel.odenisi_yoxla_94280a')}</Button> : null}
      </div> : null}
      {canSimulate ? <div className="session-bill-test" aria-label={i18n.t('ui.features.settlement.session_bill_panel.test_odenis_neticeleri_b0e8f8')}><strong>{i18n.t('ui.features.settlement.session_bill_panel.test_neticesi_8a11a1')}</strong><div className="session-bill-actions">
        <Button type="button" disabled={busy} onClick={() => void updatePayment('Succeeded')}>{i18n.t('ui.features.settlement.session_bill_panel.ugurlu_500ad6')}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void updatePayment('Failed')}>{i18n.t('ui.features.settlement.session_bill_panel.ugursuz_a71e84')}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void updatePayment('Cancelled')}>{i18n.t('ui.features.settlement.session_bill_panel.legv_451e7e')}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void updatePayment('Pending')}>{i18n.t('ui.features.settlement.session_bill_panel.gozlemede_df8d76')}</Button>
      </div></div> : null}
    </> : null}
  </section>
}
