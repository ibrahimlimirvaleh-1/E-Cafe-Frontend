import { CreditCard, Send, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useFormFeedback } from '../../shared/hooks/useFormFeedback'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type ReservationPaymentInstructionPanelProps = {
  restaurantId: string
  reservationId: string
  amount?: string
}

export function ReservationPaymentInstructionPanel({
  restaurantId,
  reservationId,
  amount,
}: ReservationPaymentInstructionPanelProps) {
  const [displayText, setDisplayText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { feedback, clearFeedback, setError, setSuccess } = useFormFeedback()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearFeedback()

    if (!displayText.trim()) {
      setError(new Error('Ödəniş məlumatı boş ola bilməz.'), 'Kart və ya ödəniş məlumatını daxil edin.')
      return
    }

    setIsSubmitting(true)

    try {
      await ecafeApi.reservations.sendPaymentInstruction(restaurantId, reservationId, { displayText })
      setDisplayText('')
      setSuccess('Ödəniş məlumatı müştəriyə göndərildi.')
    } catch (error) {
      setError(error, 'Ödəniş məlumatı göndərilə bilmədi. Rezervasiyanın statusunu yoxlayın.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="reservation-payment-panel">
      <div className="reservation-payment-panel-header">
        <div className="reservation-payment-panel-icon"><CreditCard size={20} /></div>
        <div>
          <span className="section-eyebrow">ÖDƏNİŞ MƏLUMATI</span>
          <h2>Müştəriyə kart məlumatı göndər</h2>
          <p>Bu məlumat yalnız seçilmiş rezervasiya üçün göndərilir və tarixçədə saxlanılır.</p>
        </div>
      </div>

      <div className="reservation-payment-meta">
        <span><strong>Rezervasiya</strong><b>#{reservationId}</b></span>
        <span><strong>Depozit</strong><b>{amount || 'Serverdə yoxlanılır'}</b></span>
        <span><ShieldCheck size={16} /> Məlumat qorunur</span>
      </div>

      <form onSubmit={submit}>
        <label className="reservation-payment-field">
          <span>Kart və ödəniş məlumatı</span>
          <textarea
            value={displayText}
            onChange={(event) => setDisplayText(event.target.value)}
            maxLength={1000}
            placeholder="Məsələn: ABB AZN hesabı, kart: 4169 **** **** 1234"
            rows={4}
            disabled={isSubmitting}
          />
          <small>{displayText.length}/1000</small>
        </label>

        {feedback.message ? (
          <StatusMessage autoHideMs={false} tone={feedback.tone} details={feedback.details}>
            {feedback.message}
          </StatusMessage>
        ) : null}

        <div className="reservation-payment-actions">
          <span>Müştəriyə tətbiq daxili bildiriş gedəcək.</span>
          <Button disabled={isSubmitting} type="submit">
            <Send size={17} />
            {isSubmitting ? 'Göndərilir...' : 'Məlumatı göndər'}
          </Button>
        </div>
      </form>
    </section>
  )
}
