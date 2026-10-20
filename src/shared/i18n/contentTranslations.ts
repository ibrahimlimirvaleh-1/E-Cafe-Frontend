export type ContentEntityType =
  | 'categories'
  | 'items'
  | 'tables'
  | 'inventory-items'
  | 'units'

export type ContentLanguage = 'en' | 'ru'
export type ContentField = 'name' | 'description' | 'unavailableReason'

export type ContentTranslation = {
  languageCode: 'az' | ContentLanguage
  name?: string | null
  description?: string | null
  unavailableReason?: string | null
  revision: number
}

export type ContentTranslationResponse = {
  entityType: ContentEntityType
  id: number
  restaurantId?: number
  translations: ContentTranslation[]
}

export type TranslationValues = Record<ContentLanguage, Partial<Record<ContentField, string>>>
export type TranslationPayload = { languageCode: ContentLanguage } & Partial<Record<ContentField, string>>

export function emptyTranslations(): TranslationValues {
  return { en: {}, ru: {} }
}

export function translationValuesFrom(response: ContentTranslationResponse): TranslationValues {
  const values = emptyTranslations()
  for (const row of response.translations) {
    if (row.languageCode !== 'en' && row.languageCode !== 'ru') continue
    values[row.languageCode] = {
      name: row.name ?? '',
      description: row.description ?? '',
      unavailableReason: row.unavailableReason ?? '',
    }
  }
  return values
}

export function azSourceFrom(response: ContentTranslationResponse): ContentTranslation {
  const source = response.translations.find((row) => row.languageCode === 'az')
  if (!source) throw new Error('Azərbaycan dilində əsas mətn yüklənmədi.')
  return source
}

export function translationPayload(values: TranslationValues, fields: ContentField[]): TranslationPayload[] {
  return (['en', 'ru'] as const).flatMap((languageCode) => {
    const row = Object.fromEntries(fields.map((field) => [field, values[languageCode][field]?.trim() ?? ''])) as Partial<Record<ContentField, string>>
    return Object.values(row).some(Boolean) ? [{ languageCode, ...row }] : []
  })
}

export function missingTranslationName(values: TranslationValues, fields: ContentField[]): ContentLanguage | null {
  if (!fields.includes('name')) return null
  for (const language of ['en', 'ru'] as const) {
    const row = fields.map((field) => values[language][field]?.trim() ?? '')
    if (row.some(Boolean) && !values[language].name?.trim()) return language
  }
  return null
}
