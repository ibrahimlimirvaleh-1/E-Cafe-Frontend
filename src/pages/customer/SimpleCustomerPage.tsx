import { PageHeader } from '../../shared/ui/PageHeader'

type SimpleCustomerPageProps = {
  title: string
}

export function SimpleCustomerPage({ title }: SimpleCustomerPageProps) {
  return (
    <main className="page">
      <PageHeader title={title} />
    </main>
  )
}
