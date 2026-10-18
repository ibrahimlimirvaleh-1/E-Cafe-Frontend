import fs from 'node:fs'
import path from 'node:path'

const directory = path.resolve('src/shared/i18n/catalog')
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map((language) => [language, JSON.parse(fs.readFileSync(path.join(directory, `${language}.json`), 'utf8'))]))
const forms = ['one', 'few', 'many', 'other']
const units = {
  restaurants: {
    az: ['{{count}} restoran', '{{count}} restoran', '{{count}} restoran', '{{count}} restoran'],
    en: ['{{count}} restaurant', '{{count}} restaurants', '{{count}} restaurants', '{{count}} restaurants'],
    ru: ['{{count}} ресторан', '{{count}} ресторана', '{{count}} ресторанов', '{{count}} ресторана'],
  },
  reservations: {
    az: ['{{count}} rezervasiya', '{{count}} rezervasiya', '{{count}} rezervasiya', '{{count}} rezervasiya'],
    en: ['{{count}} reservation', '{{count}} reservations', '{{count}} reservations', '{{count}} reservations'],
    ru: ['{{count}} бронирование', '{{count}} бронирования', '{{count}} бронирований', '{{count}} бронирования'],
  },
  guests: {
    az: ['{{count}} nəfər', '{{count}} nəfər', '{{count}} nəfər', '{{count}} nəfər'],
    en: ['{{count}} guest', '{{count}} guests', '{{count}} guests', '{{count}} guests'],
    ru: ['{{count}} гость', '{{count}} гостя', '{{count}} гостей', '{{count}} гостя'],
  },
  orders: {
    az: ['{{count}} sifariş', '{{count}} sifariş', '{{count}} sifariş', '{{count}} sifariş'],
    en: ['{{count}} order', '{{count}} orders', '{{count}} orders', '{{count}} orders'],
    ru: ['{{count}} заказ', '{{count}} заказа', '{{count}} заказов', '{{count}} заказа'],
  },
  items: {
    az: ['{{count}} ədəd', '{{count}} ədəd', '{{count}} ədəd', '{{count}} ədəd'],
    en: ['{{count}} item', '{{count}} items', '{{count}} items', '{{count}} items'],
    ru: ['{{count}} шт.', '{{count}} шт.', '{{count}} шт.', '{{count}} шт.'],
  },
  dishes: {
    az: ['{{count}} yemək', '{{count}} yemək', '{{count}} yemək', '{{count}} yemək'],
    en: ['{{count}} dish', '{{count}} dishes', '{{count}} dishes', '{{count}} dishes'],
    ru: ['{{count}} блюдо', '{{count}} блюда', '{{count}} блюд', '{{count}} блюда'],
  },
  sales: {
    az: ['{{count}} satış', '{{count}} satış', '{{count}} satış', '{{count}} satış'],
    en: ['{{count}} sale', '{{count}} sales', '{{count}} sales', '{{count}} sales'],
    ru: ['{{count}} продажа', '{{count}} продажи', '{{count}} продаж', '{{count}} продажи'],
  },
  sessions: {
    az: ['{{count}} sessiya', '{{count}} sessiya', '{{count}} sessiya', '{{count}} sessiya'],
    en: ['{{count}} session', '{{count}} sessions', '{{count}} sessions', '{{count}} sessions'],
    ru: ['{{count}} сеанс', '{{count}} сеанса', '{{count}} сеансов', '{{count}} сеанса'],
  },
  minutes: {
    az: ['{{count}} dəq', '{{count}} dəq', '{{count}} dəq', '{{count}} dəq'],
    en: ['{{count}} min', '{{count}} min', '{{count}} min', '{{count}} min'],
    ru: ['{{count}} мин', '{{count}} мин', '{{count}} мин', '{{count}} мин'],
  },
  days: {
    az: ['{{count}} gün', '{{count}} gün', '{{count}} gün', '{{count}} gün'],
    en: ['{{count}} day', '{{count}} days', '{{count}} days', '{{count}} days'],
    ru: ['{{count}} день', '{{count}} дня', '{{count}} дней', '{{count}} дня'],
  },
}

for (const [unit, languages] of Object.entries(units)) {
  for (const language of ['az', 'en', 'ru']) {
    for (let index = 0; index < forms.length; index++) catalogs[language][`ui.count.${unit}_${forms[index]}`] = languages[language][index]
  }
}

catalogs.az['ui.localization.resultCount_few'] = '{{count}} mətn'
catalogs.az['ui.localization.resultCount_many'] = '{{count}} mətn'
catalogs.en['ui.localization.resultCount_few'] = '{{count}} texts'
catalogs.en['ui.localization.resultCount_many'] = '{{count}} texts'

for (const language of ['az', 'en', 'ru']) {
  fs.writeFileSync(path.join(directory, `${language}.json`), `${JSON.stringify(catalogs[language], null, 2)}\n`)
}
