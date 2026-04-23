/**
 * Parse a monetary amount from Monday.com text column values.
 * Handles Dutch (dot=thousands, comma=decimal) and English (comma=thousands, dot=decimal)
 * and plain numeric formats.
 *
 * Examples:
 *   "€17.500"     → 17500
 *   "€17.500,00"  → 17500
 *   "€1.250,50"   → 1250.50
 *   "17500"       → 17500
 *   "€17,500.00"  → 17500
 *   ""            → null
 *   null          → null
 */
export function parseEuroAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = raw.replace(/[€\s]/g, '').trim()
  if (s === '') return null

  const hasDot   = s.includes('.')
  const hasComma = s.includes(',')

  let normalised: string

  if (hasDot && hasComma) {
    const lastDot   = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastDot > lastComma) {
      // EN format: "17,500.00" → dot is decimal separator
      normalised = s.replace(/,/g, '')
    } else {
      // NL format: "17.500,00" → comma is decimal separator
      normalised = s.replace(/\./g, '').replace(',', '.')
    }
  } else if (hasDot) {
    // Only dots — check if thousands separator (exactly 3 digits after last dot)
    const afterLastDot = s.slice(s.lastIndexOf('.') + 1)
    if (/^\d{3}$/.test(afterLastDot)) {
      // NL thousands: "17.500" → 17500
      normalised = s.replace(/\./g, '')
    } else {
      // EN decimal: "17.5" → 17.5
      normalised = s
    }
  } else if (hasComma) {
    // Only commas — check if thousands separator (exactly 3 digits after last comma)
    const afterLastComma = s.slice(s.lastIndexOf(',') + 1)
    if (/^\d{3}$/.test(afterLastComma)) {
      // EN thousands: "17,500" → 17500
      normalised = s.replace(/,/g, '')
    } else {
      // NL decimal comma: "17,5" → 17.5
      normalised = s.replace(',', '.')
    }
  } else {
    normalised = s
  }

  const n = parseFloat(normalised)
  return isNaN(n) ? null : n
}

// ── Unit tests (run via: npx tsx lib/utils.ts) ────────────────────────────────

if (process.argv[1]?.endsWith('utils.ts')) {
  const cases: [string | null | undefined, number | null][] = [
    ['€17.500',      17500],
    ['€17.500,00',   17500],
    ['€1.250,50',    1250.5],
    ['17500',        17500],
    ['€17,500.00',   17500],
    ['€1.210',       1210],
    ['250',          250],
    ['',             null],
    [null,           null],
    [undefined,      null],
    ['€30.915',      30915],
    ['€9.680',       9680],
  ]

  let pass = 0; let fail = 0
  for (const [input, expected] of cases) {
    const result = parseEuroAmount(input)
    const ok = result === expected
    if (ok) { pass++; console.log(`  ✓ parseEuroAmount(${JSON.stringify(input)}) = ${result}`) }
    else     { fail++; console.error(`  ✗ parseEuroAmount(${JSON.stringify(input)}) = ${result}, expected ${expected}`) }
  }
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}
