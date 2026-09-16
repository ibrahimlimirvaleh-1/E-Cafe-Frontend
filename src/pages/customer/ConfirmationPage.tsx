import { CheckCircle2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { ButtonLink } from '../../shared/ui/Button'

export function ConfirmationPage() {
  const [searchParams] = useSearchParams()
  const reservationId = searchParams.get('reservationId')

  return (
    <main className="center-page">
      <article className="success-panel">
        <CheckCircle2 size={56} />
        <h1>{reservationId ? 'Rezervasiya qeydə alındı' : 'Sifariş qeydə alındı'}</h1>
        <p>
          {reservationId
            ? `Rezervasiya #${reservationId} ödəniş gözləyir. Menecer ödəniş təsdiqi üçün sizinlə əlaqə saxlayacaq.`
            : 'Sifariş məlumatları restorana göndərildi.'}
        </p>
        <ButtonLink to="/tracking/demo-token">Rezervasiyanı izlə</ButtonLink>
      </article>
    </main>
  )
}
