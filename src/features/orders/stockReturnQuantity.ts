const scale = 1_000_000n
export function parseStockReturnQuantity(value: string): string | null {
  const normalized = value.trim().replace(',', '.')
  const match = /^(0|[1-9]\d{0,11})(?:\.(\d{1,6}))?$/.exec(normalized)
  if (!match) return null
  const fraction = (match[2] ?? '').replace(/0+$/, '')
  return fraction ? `${match[1]}.${fraction}` : match[1]
}

export function scaledStockQuantity(value: string): bigint {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'))
}

export function remainingStockQuantity(consumed: string, returned: string): string {
  const remaining = scaledStockQuantity(consumed) - scaledStockQuantity(returned)
  const whole = remaining / scale
  const fraction = String(remaining % scale).padStart(6, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : String(whole)
}
