import { ButtonLink } from '../shared/ui/Button'

export function NotFoundPage() {
  return (
    <main className="center-page">
      <article className="placeholder-panel">
        <h1>Səhifə tapılmadı</h1>
        <p>Bu route üçün frontend səhifəsi hələ mövcud deyil.</p>
        <ButtonLink to="/">Ana səhifə</ButtonLink>
      </article>
    </main>
  )
}
