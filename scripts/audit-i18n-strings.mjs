import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve('src')
const results = []
const letter = /[ƏəÖöÜüĞğŞşÇçİı]/

function inspect(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  function visit(node) {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && letter.test(node.text)) {
      const ancestor = node.parent
      if (!ts.isImportDeclaration(ancestor) && !ts.isExportDeclaration(ancestor)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
        const kind = ts.isJsxAttribute(ancestor) ? `prop:${ancestor.name.text}` : ts.SyntaxKind[ancestor.kind]
        results.push({ file: path.relative(root, file).replaceAll('\\', '/'), line, kind, text: node.text.replace(/\s+/g, ' ').slice(0, 130) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (/\.tsx?$/.test(entry.name) && !file.includes(`${path.sep}shared${path.sep}i18n${path.sep}`)) inspect(file)
  }
}

walk(root)
for (const item of results) process.stdout.write(`${item.file}:${item.line} ${item.kind} ${item.text}\n`)
process.stdout.write(`TOTAL ${results.length}\n`)
