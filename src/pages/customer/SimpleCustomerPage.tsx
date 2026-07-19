import { PageHeader } from '../../shared/ui/PageHeader'

type SimpleCustomerPageProps = {
  title: string
  description: string
}

export function SimpleCustomerPage({ description, title }: SimpleCustomerPageProps) {
  return (
    <main className="page">
      <PageHeader title={title} description={description} />
      <section className="placeholder-panel">
        <p>Bu bölmə hesab məlumatları və tarixçə axınları üçün hazırlanıb.</p>
      </section>
    </main>
  )
}
