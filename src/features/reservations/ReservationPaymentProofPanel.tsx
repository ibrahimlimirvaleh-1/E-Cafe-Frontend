import { CheckCircle2, FileCheck2, Upload } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ecafeApi } from '../../shared/api/ecafeApi'
import { useFormFeedback } from '../../shared/hooks/useFormFeedback'
import { Button } from '../../shared/ui/Button'
import { StatusMessage } from '../../shared/ui/StatusMessage'

type ReservationPaymentProofPanelProps = {
  restaurantId: string
  reservationId: string
  amount: number
}

const maxFileSizeBytes = 10 * 1024 * 1024

export function ReservationPaymentProofPanel({
  restaurantId,
  reservationId,
  amount,
}: ReservationPaymentProofPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const { feedback, clearFeedback, setError, setSuccess } = useFormFeedback()

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    clearFeedback()
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (file.size > maxFileSizeBytes) {
      event.target.value = ''
      setSelectedFile(null)
      setError(new Error('Fayl çox böyükdür.'), 'Maksimum 10 MB ölçüdə fayl seçin.')
      return
    }

    setSelectedFile(file)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearFeedback()

    if (!selectedFile) {
      setError(new Error('Ödəniş çeki seçilməyib.'), 'Əvvəlcə bank çekini seçin.')
      return
    }

    setIsSubmitting(true)

    try {
      await ecafeApi.reservations.submitPaymentProof(restaurantId, reservationId, selectedFile)
      setIsSubmitted(true)
      setSuccess('Ödəniş çeki göndərildi. Restoran təsdiq etdikdən sonra rezervasiya tamamlanacaq.')
    } catch (error) {
      setError(error, 'Ödəniş çeki göndərilmədi. Rezervasiyanın statusunu yoxlayıb yenidən cəhd edin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="reservation-proof-panel">
      <div className="reservation-proof-header">
        <div className="reservation-proof-icon"><FileCheck2 size={20} /></div>
        <div>
          <span className="section-eyebrow">ÖDƏNİŞ ÇEKİ</span>
          <h3>Bank çekini göndər</h3>
          <p>{amount.toFixed(2)} AZN depozit üçün çekin şəklini və ya PDF faylını əlavə edin.</p>
        </div>
      </div>

      {isSubmitted ? (
        <div className="reservation-proof-submitted">
          <CheckCircle2 size={19} />
          <span>Çek göndərildi. Restoranın təsdiqi gözlənilir.</span>
        </div>
      ) : (
        <form className="reservation-proof-form" onSubmit={submit}>
          <label className="reservation-proof-file-field">
            <span>Çek faylı</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/avif"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
            <strong>
              <Upload size={17} />
              {selectedFile?.name || 'Şəkil və ya PDF seçin'}
            </strong>
            <small>PDF, JPG, PNG, WEBP və ya AVIF. Maksimum 10 MB.</small>
          </label>

          {feedback.message ? (
            <StatusMessage autoHideMs={false} tone={feedback.tone} details={feedback.details}>
              {feedback.message}
            </StatusMessage>
          ) : null}

          <div className="reservation-proof-actions">
            <span>Çek yalnız bu rezervasiyaya bağlanacaq.</span>
            <Button disabled={isSubmitting} type="submit">
              <FileCheck2 size={17} />
              {isSubmitting ? 'Göndərilir...' : 'Çeki göndər'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
