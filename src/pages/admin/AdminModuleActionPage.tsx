import { AlertTriangle } from 'lucide-react'
import type { AdminModuleKey } from '../../entities/types'
import { getAdminModule } from '../../entities/mockData'
import { Button } from '../../shared/ui/Button'
import { ButtonLink } from '../../shared/ui/Button'

type AdminModuleActionPageProps = {
  moduleKey: AdminModuleKey
  action: 'deactivate' | 'terminate'
}

export function AdminModuleActionPage({ action, moduleKey }: AdminModuleActionPageProps) {
  const module = getAdminModule(moduleKey)
  const label = module.dangerLabel ?? (action === 'terminate' ? 'Müqaviləni ləğv et' : 'Deaktiv et')

  return (
    <main className="center-page">
      <article className="danger-panel">
        <AlertTriangle size={52} />
        <h1>{label}</h1>
        <p>Bu əməliyyat soft status update kimi işləməlidir və audit event yaratmalıdır. Real silmə backend-də də qadağan olunacaq.</p>
        <div className="action-row">
          <ButtonLink variant="secondary" to={module.route}>
            Geri
          </ButtonLink>
          <Button variant="danger" type="button">
            Təsdiqlə
          </Button>
        </div>
      </article>
    </main>
  )
}
