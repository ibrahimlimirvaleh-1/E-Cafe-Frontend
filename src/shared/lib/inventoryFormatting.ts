import { i18n, getCurrentLanguage } from '../i18n/i18n'
import { getIntlLocale } from '../i18n/language'

export function inventoryUnitLabel(code: string, name: string) {
  return code.toLowerCase() === 'pcs' ? i18n.t('ui.inventoryHistory.unitPieces') : code || name
}

export function formatInventoryQuantity(value: number, signed = false) {
  const amount = new Intl.NumberFormat(getIntlLocale(getCurrentLanguage()), {
    maximumFractionDigits: 6,
  }).format(Math.abs(value))
  return signed ? `${value > 0 ? '+' : value < 0 ? '\u2212' : ''}${amount}` : amount
}

export function formatInventoryCost(value: number) {
  return new Intl.NumberFormat(getIntlLocale(getCurrentLanguage()), {
    style: 'currency',
    currency: 'AZN',
    currencyDisplay: 'narrowSymbol',
    ...(value > 0 && value < 0.000001 ? { maximumSignificantDigits: 6 } : { maximumFractionDigits: 6 }),
  }).format(value)
}
