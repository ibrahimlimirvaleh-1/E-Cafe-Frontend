import { CalendarDays, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Restaurant } from '../../entities/types'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'

function localToday(timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'Asia/Baku',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function formatRuleDate(date: string) {
  return new Intl.DateTimeFormat('az-AZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

export function RestaurantDepositRulesPanel({ restaurantId }: { restaurantId: string }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [actionError, setActionError] = useState('')
  const { data: restaurant, error, isLoading } = useAsyncData<Restaurant | null>(
    () => restaurantId ? ecafeApi.restaurants.adminDetail(restaurantId) : Promise.resolve(null),
    null,
    [restaurantId, refreshKey],
  )
  const today = localToday(restaurant?.timeZone)
  const rules = useMemo(
    () => (restaurant?.depositRules || []).filter((rule) => rule.reservationDate >= today)
      .sort((first, second) => first.reservationDate.localeCompare(second.reservationDate)),
    [restaurant, today],
  )
  const selectedRule = rules.find((rule) => rule.reservationDate === date)

  useEffect(() => {
    if (!date || date < today) setDate(today)
  }, [date, today])

  useEffect(() => {
    setAmount(selectedRule ? String(selectedRule.amount) : '')
  }, [restaurantId, date, selectedRule?.amount])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError('')
    setFeedback('')
    const parsedAmount = Number(amount)
    if (!date || date < today || !/^\d+(?:\.\d{1,2})?$/.test(amount.trim()) || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000) {
      setActionError('Gələcək tarix və 0-dan böyük, iki onluq rəqəmli depozit məbləği daxil edin.')
      return
    }
    setIsSaving(true)
    try {
      await ecafeApi.restaurants.setDepositRule(restaurantId, date, parsedAmount)
      setFeedback('Tarix üzrə depozit saxlanıldı. Mövcud rezervasiyaların məbləği dəyişmir.')
      setRefreshKey((current) => current + 1)
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Depozit qaydası saxlanılmadı.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove() {
    if (!selectedRule) return
    setActionError('')
    setFeedback('')
    setIsSaving(true)
    try {
      await ecafeApi.restaurants.removeDepositRule(restaurantId, date)
      setFeedback('Bu tarix üçün depozit ləğv edildi. Yeni rezervasiyalar depozitsiz olacaq.')
      setRefreshKey((current) => current + 1)
    } catch (removeError) {
      setActionError(removeError instanceof Error ? removeError.message : 'Tarix qaydası silinmədi.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="deposit-rules-panel" aria-label="Tarix üzrə depozit">
      <div className="deposit-rules-heading">
        <div>
          <span className="section-eyebrow">REZERVASİYA QAYDASI</span>
          <h2>Tarix üzrə depozit</h2>
        </div>
        <div className="deposit-rules-default">Qayda olmayan günlər <strong>Depozitsiz</strong></div>
      </div>
      {error ? <StatusMessage tone="danger" autoHideMs={false}>{error}</StatusMessage> : null}
      {actionError ? <StatusMessage tone="danger" autoHideMs={false}>{actionError}</StatusMessage> : null}
      {feedback ? <StatusMessage tone="success">{feedback}</StatusMessage> : null}
      <form className="deposit-rules-form" onSubmit={handleSave}>
        <label>
          <span>Rezervasiya tarixi</span>
          <span className="deposit-rules-input"><CalendarDays size={18} /><input min={today} onChange={(event) => setDate(event.target.value)} type="date" value={date} /></span>
        </label>
        <label>
          <span>Depozit (AZN)</span>
          <input min="0.01" max="100000" onChange={(event) => setAmount(event.target.value)} step="0.01" type="number" value={amount} />
        </label>
        <Button disabled={!restaurantId || isLoading || isSaving} type="submit"><Save size={17} />Saxla</Button>
        {selectedRule ? <Button disabled={isSaving} onClick={handleRemove} type="button" variant="secondary"><Trash2 size={17} />Depoziti ləğv et</Button> : null}
      </form>
      {rules.length > 0 ? (
        <div className="deposit-rules-list" aria-label="Təyin edilmiş tarixlər">
          {rules.map((rule) => (
            <button className={rule.reservationDate === date ? 'active' : ''} key={rule.reservationDate} onClick={() => setDate(rule.reservationDate)} type="button">
              <span>{formatRuleDate(rule.reservationDate)}</span><strong>{rule.amount.toFixed(2)} AZN</strong>
            </button>
          ))}
        </div>
      ) : !isLoading && !error ? <p className="deposit-rules-empty">Hələ tarix üzrə ayrıca məbləğ təyin edilməyib.</p> : null}
    </section>
  )
}
