import { CheckCircle2 } from 'lucide-react'
import { ButtonLink } from '../../shared/ui/Button'

export function ConfirmationPage() {
  return (
    <main className="center-page">
      <article className="success-panel">
        <CheckCircle2 size={56} />
        <h1>Rezervasiya təsdiqləndi</h1>
        <p>Rezerv Reserved statusuna keçdi, masa və seçilən ofisiant bloklandı, manager/waiter mesajı yaradıldı.</p>
        <ButtonLink to="/tracking/demo-token">Order tracking səhifəsinə keç</ButtonLink>
      </article>
    </main>
  )
}
