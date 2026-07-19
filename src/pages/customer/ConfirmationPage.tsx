import { CheckCircle2 } from 'lucide-react'
import { ButtonLink } from '../../shared/ui/Button'

export function ConfirmationPage() {
  return (
    <main className="center-page">
      <article className="success-panel">
        <CheckCircle2 size={56} />
        <h1>Rezervasiya təsdiqləndi</h1>
        <p>Masa və seçilən ofisiant rezervasiya vaxtı üçün saxlanıldı. Restoran komandası məlumatlandırıldı.</p>
        <ButtonLink to="/tracking/demo-token">Order tracking səhifəsinə keç</ButtonLink>
      </article>
    </main>
  )
}
