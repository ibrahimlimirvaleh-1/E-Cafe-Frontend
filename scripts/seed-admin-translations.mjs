import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const source = ts.createSourceFile('mockData.ts', fs.readFileSync('src/entities/mockData.ts', 'utf8'), ts.ScriptTarget.Latest, true)
const moduleArray = source.statements.flatMap((statement) => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [])
  .find((declaration) => declaration.name.getText(source) === 'adminModules')?.initializer
if (!moduleArray || !ts.isArrayLiteralExpression(moduleArray)) throw new Error('adminModules not found')

function fields(object) {
  return Object.fromEntries(object.properties.filter(ts.isPropertyAssignment).map((property) => {
    const value = property.initializer
    return [property.name.getText(source), ts.isArrayLiteralExpression(value) ? value.elements.map((item) => item.text) : value.text]
  }))
}

const sourceModules = Object.fromEntries(moduleArray.elements.map((element) => {
  const module = fields(element)
  return [module.key, module]
}))

const translations = {
  restaurants: {
    en: ['Restaurants', 'Restaurant', 'New restaurant', 'Deactivate restaurant', 'Profile and activity status.', ['Restaurant', 'Status', 'Contract', 'Phone']],
    ru: ['Рестораны', 'Ресторан', 'Новый ресторан', 'Деактивировать ресторан', 'Профиль и статус активности.', ['Ресторан', 'Статус', 'Договор', 'Телефон']],
  },
  'restaurant-groups': {
    en: ['Restaurant groups', 'Restaurant group', 'New group', null, 'Organize branches under one business group.', ['Group', 'Status', 'Legal name', 'Branch']],
    ru: ['Группы ресторанов', 'Группа ресторанов', 'Новая группа', null, 'Объединение филиалов в одну бизнес-группу.', ['Группа', 'Статус', 'Юридическое название', 'Филиал']],
  },
  contracts: {
    en: ['Contracts', 'Contract', 'New contract', 'Terminate contract', 'Commercial and legal terms between the platform and restaurant.', ['Contract', 'Status', 'Period', 'Payment policy']],
    ru: ['Договоры', 'Договор', 'Новый договор', 'Расторгнуть договор', 'Коммерческие и юридические условия между платформой и рестораном.', ['Договор', 'Статус', 'Период', 'Условия оплаты']],
  },
  reservations: {
    en: ['Reservations', 'Reservation', null, null, 'Table reservations and arrival statuses.', ['Reservation', 'Status', 'Date', 'Deposit']],
    ru: ['Бронирования', 'Бронирование', null, null, 'Бронирование столов и статусы прибытия.', ['Бронирование', 'Статус', 'Дата', 'Депозит']],
  },
  orders: {
    en: ['Orders', 'Order', null, null, 'Order statuses and amounts.', ['Order', 'Status', 'Source', 'Amount']],
    ru: ['Заказы', 'Заказ', null, null, 'Статусы и суммы заказов.', ['Заказ', 'Статус', 'Источник', 'Сумма']],
  },
  payments: {
    en: ['Payments', 'Payment', null, null, 'Payment and refund status.', ['Payment', 'Status', 'Provider', 'Amount']],
    ru: ['Платежи', 'Платёж', null, null, 'Статусы платежей и возвратов.', ['Платёж', 'Статус', 'Провайдер', 'Сумма']],
  },
  staff: {
    en: ['Staff', 'Employee', 'New employee', 'Deactivate employee', 'Roles, service fees and settlement details.', ['Employee', 'Status', 'Role', 'Earnings']],
    ru: ['Персонал', 'Сотрудник', 'Новый сотрудник', 'Деактивировать сотрудника', 'Роли, сервисный сбор и расчёты.', ['Сотрудник', 'Статус', 'Роль', 'Доход']],
  },
  tables: {
    en: ['Tables', 'Table', 'New table', 'Deactivate table', 'Capacity, visibility and current table status.', ['Table', 'Status', 'Capacity', 'Visibility']],
    ru: ['Столы', 'Стол', 'Новый стол', 'Деактивировать стол', 'Вместимость, видимость и текущее состояние стола.', ['Стол', 'Статус', 'Вместимость', 'Видимость']],
  },
  categories: {
    en: ['Categories', 'Category', 'New category', 'Deactivate category', 'Menu categories.', ['Category', 'Status', 'Restaurant', 'Number of dishes']],
    ru: ['Категории', 'Категория', 'Новая категория', 'Деактивировать категорию', 'Категории меню.', ['Категория', 'Статус', 'Ресторан', 'Количество блюд']],
  },
  menu: {
    en: ['Menu', 'Menu item', 'New menu item', 'Deactivate menu item', 'Products, prices, categories and availability.', ['Product', 'Status', 'Category', 'Price']],
    ru: ['Меню', 'Позиция меню', 'Новая позиция меню', 'Деактивировать позицию меню', 'Товары, цены, категории и доступность.', ['Товар', 'Статус', 'Категория', 'Цена']],
  },
  inventory: {
    en: ['Inventory', 'Inventory item', 'New inventory item', 'Deactivate inventory item', 'Ingredients and low-stock thresholds.', ['Ingredient', 'Status', 'Quantity', 'Threshold']],
    ru: ['Склад', 'Складская позиция', 'Новая складская позиция', 'Деактивировать складскую позицию', 'Ингредиенты и пороги остатка.', ['Ингредиент', 'Статус', 'Количество', 'Порог']],
  },
  'inventory-movements': {
    en: ['Inventory movements', 'Inventory movement', 'New movement', null, 'History of stock receipts, usage and adjustments.', ['Ingredient', 'Movement', 'Quantity', 'Reason']],
    ru: ['Движение запасов', 'Движение запасов', 'Новое движение', null, 'История поступления, расхода и корректировок.', ['Ингредиент', 'Движение', 'Количество', 'Причина']],
  },
  recipes: {
    en: ['Recipes', 'Recipe', 'New recipe', 'Deactivate recipe', 'Ingredient composition of menu items.', ['Product', 'Ingredient', 'Quantity', 'Status']],
    ru: ['Рецепты', 'Рецепт', 'Новый рецепт', 'Деактивировать рецепт', 'Состав ингредиентов блюд меню.', ['Товар', 'Ингредиент', 'Количество', 'Статус']],
  },
  'audit-logs': {
    en: ['Audit logs', 'Audit log', null, null, 'Track contract, restaurant, file and administrative actions.', ['Action', 'Object', 'Performed by', 'Date']],
    ru: ['Журнал аудита', 'Запись аудита', null, null, 'Отслеживание действий с договорами, ресторанами, файлами и администрированием.', ['Действие', 'Объект', 'Исполнитель', 'Дата']],
  },
}

const inventoryPages = {
  items: { az: ['Stok', 'Stok elementleri'], en: ['Inventory', 'Inventory items'], ru: ['Склад', 'Складские позиции'] },
  create: { az: ['Stok', 'Yeni stok elementi'], en: ['Inventory', 'New inventory item'], ru: ['Склад', 'Новая складская позиция'] },
  movements: { az: ['Stok', 'Stok hereketleri'], en: ['Inventory', 'Inventory movements'], ru: ['Склад', 'Движение запасов'] },
  'movement-create': { az: ['Stok', 'Yeni stok hereketi'], en: ['Inventory', 'New inventory movement'], ru: ['Склад', 'Новое движение запасов'] },
  recipes: { az: ['Resept', 'Resept idareetmesi'], en: ['Recipe', 'Recipe management'], ru: ['Рецепт', 'Управление рецептами'] },
  'recipe-create': { az: ['Resept', 'Yeni resept terkibi'], en: ['Recipe', 'New recipe composition'], ru: ['Рецепт', 'Новый состав рецепта'] },
}
const inventoryUnits = {
  1: { az: 'Kilogram', en: 'Kilogram', ru: 'Килограмм' },
  2: { az: 'Qram', en: 'Gram', ru: 'Грамм' },
  3: { az: 'Litr', en: 'Liter', ru: 'Литр' },
  4: { az: 'Millilitr', en: 'Milliliter', ru: 'Миллилитр' },
  5: { az: 'Eded', en: 'Piece', ru: 'Штука' },
}

const adminStatuses = {
  pendingDeposit: ['Depozit gözləyir', 'Awaiting deposit', 'Ожидает депозит'],
  reserved: ['Rezerv edilib', 'Reserved', 'Забронировано'],
  seated: ['Oturub', 'Seated', 'Гость за столом'],
  completed: ['Tamamlanıb', 'Completed', 'Завершено'],
  cancelled: ['Ləğv edilib', 'Cancelled', 'Отменено'],
  noShow: ['Gəlmədi', 'No-show', 'Не явился'],
  created: ['Yaradılıb', 'Created', 'Создано'],
  accepted: ['Qəbul edilib', 'Accepted', 'Принято'],
  preparing: ['Hazırlanır', 'Preparing', 'Готовится'],
  ready: ['Hazırdır', 'Ready', 'Готово'],
  served: ['Servis edilib', 'Served', 'Подано'],
  closed: ['Bağlanıb', 'Closed', 'Закрыто'],
  pending: ['Gözləyir', 'Pending', 'Ожидает'],
  paid: ['Ödənilib', 'Paid', 'Оплачено'],
  failed: ['Uğursuz', 'Failed', 'Ошибка'],
  refunded: ['Geri qaytarılıb', 'Refunded', 'Возвращено'],
  active: ['Aktiv', 'Active', 'Активно'],
  inactive: ['Deaktiv', 'Inactive', 'Неактивно'],
  available: ['Boşdur', 'Available', 'Свободно'],
  occupied: ['Məşğuldur', 'Occupied', 'Занято'],
  hidden: ['Gizlidir', 'Hidden', 'Скрыто'],
  onSale: ['Satışdadır', 'On sale', 'В продаже'],
  temporarilyUnavailable: ['Müvəqqəti yoxdur', 'Temporarily unavailable', 'Временно недоступно'],
}

const directory = path.resolve('src/shared/i18n/catalog')
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map((language) => [language, JSON.parse(fs.readFileSync(path.join(directory, `${language}.json`), 'utf8'))]))
for (const [key, sourceModule] of Object.entries(sourceModules)) {
  if (!translations[key]) throw new Error(`Missing module translation: ${key}`)
  for (const language of ['az', 'en', 'ru']) {
    const values = language === 'az'
      ? [sourceModule.title, sourceModule.singular, sourceModule.createLabel, sourceModule.dangerLabel, sourceModule.description, sourceModule.columns]
      : translations[key][language]
    if (values[5].length !== sourceModule.columns.length) throw new Error(`Column count mismatch: ${key}/${language}`)
    for (const [index, field] of ['title', 'singular', 'createLabel', 'dangerLabel', 'description'].entries()) {
      if (values[index] != null) catalogs[language][`ui.adminModule.${key}.${field}`] = values[index]
    }
    values[5].forEach((column, index) => { catalogs[language][`ui.adminModule.${key}.column${index}`] = column })
  }
}
for (const [mode, languages] of Object.entries(inventoryPages)) {
  for (const language of ['az', 'en', 'ru']) {
    catalogs[language][`ui.inventory.page.${mode}.eyebrow`] = languages[language][0]
    catalogs[language][`ui.inventory.page.${mode}.title`] = languages[language][1]
  }
}
for (const [unit, labels] of Object.entries(inventoryUnits)) {
  for (const language of ['az', 'en', 'ru']) catalogs[language][`ui.inventory.unit.${unit}`] = labels[language]
}
for (const [status, labels] of Object.entries(adminStatuses)) {
  ['az', 'en', 'ru'].forEach((language, index) => { catalogs[language][`ui.adminStatus.${status}`] = labels[index] })
}
for (const language of ['az', 'en', 'ru']) {
  fs.writeFileSync(path.join(directory, `${language}.json`), `${JSON.stringify(catalogs[language], null, 2)}\n`)
}
