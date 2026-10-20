import { i18n } from './i18n'

export function roleLabel(roleId: string | number, fallback?: string) {
  return i18n.t(`ui.adminFlow.role.${roleId}`, { defaultValue: fallback || `Role #${roleId}` })
}
