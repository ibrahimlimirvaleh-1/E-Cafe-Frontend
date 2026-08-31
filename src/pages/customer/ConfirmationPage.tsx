import { CheckCircle2 } from 'lucide-react'
import { ButtonLink } from '../../shared/ui/Button'

export function ConfirmationPage() {
  return (
    <main className="center-page">
      <article className="success-panel">
        <CheckCircle2 size={56} />
        <h1>Rezervasiya qeydə alındı</h1>
        <p>Masa seçimi və sifariş məlumatları restorana göndərildi. Menecer ödəniş təsdiqi üçün sizinlə əlaqə saxlayacaq.</p>
        <ButtonLink to="/tracking/demo-token">Rezervasiyanı izlə</ButtonLink>
      </article>
    </main>
  )
}
