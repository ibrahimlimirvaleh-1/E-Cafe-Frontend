import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve('src')
const catalogPath = path.join(root, 'shared', 'i18n', 'catalog')
const catalogs = Object.fromEntries(['az', 'en', 'ru'].map((language) => [language, JSON.parse(fs.readFileSync(path.join(catalogPath, `${language}.json`), 'utf8'))]))
const textAttributes = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'ariaLabel', 'description', 'eyebrow', 'message', 'hint', 'confirmLabel', 'data-label'])
const ignoredValues = new Set(['AZ', 'EN', 'RU', 'ECafe', 'AZN', 'MB'])
const results = []

function slug(text) {
  return text.toLocaleLowerCase('az').replace(/[əğışçöü]/g, (letter) => ({ ə: 'e', ğ: 'g', ı: 'i', ş: 's', ç: 'c', ö: 'o', ü: 'u' })[letter])
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 38)
}

function keyFor(file, text) {
  const stem = path.relative(root, file).replaceAll('\\', '/').replace(/\.tsx$/, '')
    .split('/').map((part) => part.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()).join('.')
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 6)
  return `ui.${stem}.${slug(text) || 'text'}_${hash}`
}

function addTranslation(file, text) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.startsWith('ui.') || ignoredValues.has(normalized) || !/[A-Za-zƏəÖöÜüĞğŞşÇçİıА-Яа-я]/.test(normalized) || normalized.includes('&')) return null
  const key = keyFor(file, normalized)
  for (const language of ['az', 'en', 'ru']) catalogs[language][key] ??= normalized
  return key
}

function processFile(file) {
  const relative = path.relative(process.cwd(), file).replaceAll('\\', '/')
  if (relative.startsWith('src/shared/i18n/') || relative === 'src/shared/layout/Brand.tsx') return
  const content = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const changes = []
  const visit = (node) => {
    if (ts.isJsxText(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const key = addTranslation(file, node.text)
      if (key) {
        const leading = node.text.match(/^\s*/)?.[0] ?? ''
        const trailing = node.text.match(/\s*$/)?.[0] ?? ''
        changes.push({ start: node.pos, end: node.end, value: `${leading}{i18n.t('${key}')}${trailing}` })
      }
    }
    if (ts.isJsxAttribute(node) && textAttributes.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const key = addTranslation(file, node.initializer.text)
      if (key) changes.push({ start: node.initializer.pos, end: node.initializer.end, value: `{i18n.t('${key}')}` })
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      ((ts.isConditionalExpression(node.parent) && (node.parent.whenTrue === node || node.parent.whenFalse === node)) || ts.isJsxExpression(node.parent))) {
      let ancestor = node.parent
      while (ancestor && !ts.isJsxExpression(ancestor) &&
        !ts.isCallExpression(ancestor) && !ts.isArrowFunction(ancestor) &&
        !ts.isFunctionExpression(ancestor) && !ts.isVariableDeclaration(ancestor)) ancestor = ancestor.parent
      const attribute = ancestor?.parent && ts.isJsxAttribute(ancestor.parent) ? ancestor.parent.name.text : null
      if (ancestor && (!attribute || textAttributes.has(attribute))) {
        const key = addTranslation(file, node.text)
        if (key) changes.push({ start: node.pos, end: node.end, value: `i18n.t('${key}')` })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (changes.length === 0) return
  const importPath = path.relative(path.dirname(file), path.join(root, 'shared', 'i18n', 'i18n')).replaceAll('\\', '/')
  const importSpecifier = importPath.startsWith('.') ? importPath : `./${importPath}`
  let updated = content
  for (const change of changes.sort((a, b) => b.start - a.start)) {
    updated = updated.slice(0, change.start) + change.value + updated.slice(change.end)
  }
  if (!/import\s*\{[^}]*\bi18n\b[^}]*\}\s*from/.test(updated)) updated = `import { i18n } from '${importSpecifier}'\n${updated}`
  results.push({ file: relative, count: changes.length })
  if (process.argv.includes('--apply')) fs.writeFileSync(file, updated)
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (entry.name.endsWith('.tsx')) processFile(file)
  }
}

walk(root)
if (process.argv.includes('--apply')) {
  for (const language of ['az', 'en', 'ru']) fs.writeFileSync(path.join(catalogPath, `${language}.json`), `${JSON.stringify(catalogs[language], null, 2)}\n`)
}
for (const item of results.sort((a, b) => b.count - a.count)) process.stdout.write(`${item.count.toString().padStart(3)} ${item.file}\n`)
process.stdout.write(`TOTAL ${results.reduce((sum, item) => sum + item.count, 0)} replacements in ${results.length} files\n`)
