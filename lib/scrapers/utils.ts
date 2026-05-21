/**
 * Shared utilities for all scrapers:
 * - Randomised browser headers
 * - Timeout wrapper
 * - Rate limiter (per-domain)
 * - Decimal ↔ fractional odds conversion
 */

// ─── Headers ─────────────────────────────────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
]

export function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

export function browserHeaders(referer?: string): HeadersInit {
  return {
    'User-Agent': randomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'DNT': '1',
    ...(referer ? { Referer: referer } : {}),
  }
}

export function jsonHeaders(referer?: string): HeadersInit {
  return {
    'User-Agent': randomUA(),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Cache-Control': 'no-cache',
    ...(referer ? { Referer: referer } : {}),
  }
}

// ─── Timeout wrapper ─────────────────────────────────────────────────────────

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`[${label}] timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!))
}

// ─── Safe fetch ──────────────────────────────────────────────────────────────

interface FetchOpts {
  timeoutMs?: number
  headers?: HeadersInit
  label?: string
}

export async function safeFetch(url: string, opts: FetchOpts = {}): Promise<Response | null> {
  const { timeoutMs = 15_000, headers = jsonHeaders(), label = url } = opts
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // Use cache: 'no-store' to bypass Next.js fetch caching, which can
    // consume the response body stream before our code reads it.
    const res = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    return res
  } catch (e) {
    console.warn(`[scraper] ${label} failed: ${(e as Error).message}`)
    return null
  }
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const lastCallTime = new Map<string, number>()

export async function rateLimit(domain: string, minIntervalMs = 500): Promise<void> {
  const last = lastCallTime.get(domain) ?? 0
  const wait = minIntervalMs - (Date.now() - last)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCallTime.set(domain, Date.now())
}

// ─── Odds converters ─────────────────────────────────────────────────────────

/** Convert fractional string "5/2" or "5-2" to decimal */
export function fractionalToDecimal(frac: string): number {
  const parts = frac.replace('-', '/').split('/')
  if (parts.length !== 2) return 0
  const [n, d] = parts.map(Number)
  if (!d || isNaN(n) || isNaN(d)) return 0
  return parseFloat((1 + n / d).toFixed(3))
}

/** Convert American odds (+150 / -110) to decimal */
export function americanToDecimal(american: number): number {
  if (american > 0) return parseFloat((1 + american / 100).toFixed(3))
  return parseFloat((1 - 100 / american).toFixed(3))
}

/** Parse a raw odds string that could be decimal, fractional or american */
export function parseOdds(raw: string | number): number {
  if (typeof raw === 'number') return raw
  const s = raw.trim()
  if (s.includes('/')) return fractionalToDecimal(s)
  if (s.startsWith('+') || (s.startsWith('-') && !s.includes('.'))) {
    return americanToDecimal(parseInt(s, 10))
  }
  return parseFloat(s) || 0
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function nextNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}
