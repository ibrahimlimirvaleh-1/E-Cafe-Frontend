import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import i18next from 'i18next'

const directory = path.resolve('src/shared/i18n/catalog')
const languages = ['az', 'en', 'ru']
const catalogs = Object.fromEntries(languages.map((language) => [language, JSON.parse(fs.readFileSync(path.join(directory, `${language}.json`), 'utf8'))]))
const referenceKeys = Object.keys(catalogs.az).sort()
const placeholders = (value) => [...value.matchAll(/{{\s*([\w.]+)(?:\s*,[^}]*)?\s*}}/g)].map((match) => match[1]).sort()

for (const language of languages) {
  assert.deepEqual(Object.keys(catalogs[language]).sort(), referenceKeys, `${language} catalog keys differ`)
  for (const key of referenceKeys) {
    assert.equal(typeof catalogs[language][key], 'string', `${language}/${key} is not text`)
    assert(catalogs[language][key].trim(), `${language}/${key} is empty`)
    assert.deepEqual(placeholders(catalogs[language][key]), placeholders(catalogs.az[key]), `${language}/${key} placeholders differ`)
  }
}

const i18n = i18next.createInstance()
await i18n.init({ lng: 'ru', fallbackLng: 'az', keySeparator: false, resources: Object.fromEntries(languages.map((language) => [language, { translation: catalogs[language] }])), interpolation: { escapeValue: false } })
for (const [count, suffix] of [[0, 'ресторанов'], [1, 'ресторан'], [2, 'ресторана'], [5, 'ресторанов'], [21, 'ресторан'], [22, 'ресторана']]) {
  assert.equal(i18n.t('ui.count.restaurants', { count }), `${count} ${suffix}`)
}
for (const [count, suffix] of [[0, 'restaurants'], [1, 'restaurant'], [2, 'restaurants'], [5, 'restaurants'], [21, 'restaurants'], [22, 'restaurants']]) {
  assert.equal(i18n.t('ui.count.restaurants', { count, lng: 'en' }), `${count} ${suffix}`)
}

console.log(`PASS ${referenceKeys.length} matching, nonempty AZ/EN/RU keys with matching placeholders; EN/RU plural counts 0/1/2/5/21/22`)
