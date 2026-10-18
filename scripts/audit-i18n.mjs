import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve('src')
const textAttributes = new Set(['placeholder', 'title', 'aria-label', 'alt'])
const ignored = new Set(['src/shared/i18n'])
const results = []

function visitFile(file) {
  const relative = path.relative(process.cwd(), file).replaceAll('\\', '/')
  if (ignored.has(relative.slice(0, relative.lastIndexOf('/')))) return
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (node) => {
    let value = ''
    if (ts.isJsxText(node)) value = node.text.replace(/\s+/g, ' ').trim()
    if (ts.isJsxAttribute(node) && textAttributes.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) {
      value = node.initializer.text.trim()
    }
    if (value && /[A-Za-zƏəÖöÜüĞğŞşÇçİıА-Яа-я]/.test(value)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      results.push({ file: relative, line, text: value })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (/\.tsx$/.test(entry.name)) visitFile(file)
  }
}

walk(root)
const grouped = Map.groupBy(results, (item) => item.file)
for (const [file, entries] of [...grouped].sort((a, b) => b[1].length - a[1].length)) {
  process.stdout.write(`${entries.length.toString().padStart(3)} ${file}\n`)
  if (process.argv.includes('--details')) {
    for (const entry of entries) process.stdout.write(`    ${entry.line}: ${entry.text}\n`)
  }
}
process.stdout.write(`TOTAL ${results.length} literal UI text candidates in ${grouped.size} files\n`)
