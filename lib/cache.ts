import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), '.cache')

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
}

export function cacheGet<T>(key: string, maxAgeMs = 300_000): T | null {
  try {
    ensureDir()
    const file = path.join(CACHE_DIR, `${key}.json`)
    if (!fs.existsSync(file)) return null
    const raw = fs.readFileSync(file, 'utf8')
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > maxAgeMs) return null
    return data as T
  } catch {
    return null
  }
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    ensureDir()
    const file = path.join(CACHE_DIR, `${key}.json`)
    fs.writeFileSync(file, JSON.stringify({ data, ts: Date.now() }), 'utf8')
  } catch (e) {
    console.error('[cache] write error:', e)
  }
}

export function cacheDelete(key: string): void {
  try {
    const file = path.join(CACHE_DIR, `${key}.json`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  } catch {}
}
