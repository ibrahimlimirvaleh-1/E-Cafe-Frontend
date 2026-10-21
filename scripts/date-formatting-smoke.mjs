import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/shared/lib/dateFormatting.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`
const { formatDateOnlyAz, formatDateInBaku, formatReservationDateTime } = await import(moduleUrl)

const NativeDateTimeFormat = Intl.DateTimeFormat
Intl.DateTimeFormat = class extends NativeDateTimeFormat {
  formatToParts(date) {
    const parts = super.formatToParts(date)
    if (this.resolvedOptions().locale !== 'az-AZ' || this.resolvedOptions().month !== 'long') return parts
    return parts.map((part) => part.type === 'month' ? { ...part, value: 'M10' } : part)
  }
}

try {
  assert.equal(formatDateOnlyAz('2026-10-18'), '18.10.2026')
  assert.equal(formatDateInBaku('2026-10-18T07:00:00Z'), '18.10.2026')
  assert.equal(formatReservationDateTime('2026-10-18T07:00:00Z', 'Asia/Baku'), '18.10.2026, 11:00')
  console.log('Date formatting smoke passed')
} finally {
  Intl.DateTimeFormat = NativeDateTimeFormat
}
