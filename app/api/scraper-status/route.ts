/**
 * GET /api/scraper-status
 *
 * Returns live stats for all scrapers: which ones succeeded/failed,
 * how many events each returned, and how long each took.
 * Useful for debugging which data sources are live.
 */
import { NextResponse } from 'next/server'
import { getScraperStatus } from '../../../lib/aggregator'

export const revalidate = 60

export async function GET() {
  const results = await getScraperStatus()

  return NextResponse.json({
    scrapers: results,
    totalEvents: results.reduce((sum, r) => sum + r.eventCount, 0),
    timestamp: new Date().toISOString(),
  })
}
