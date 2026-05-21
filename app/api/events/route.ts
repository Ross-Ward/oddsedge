import { NextResponse } from 'next/server'
import { getAllEvents } from '@/lib/aggregator'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport')

  try {
    let events = await getAllEvents()
    if (sport && sport !== 'all') {
      events = events.filter(e => e.sport === sport)
    }
    return NextResponse.json({ success: true, data: events, count: events.length })
  } catch (e) {
    console.error('[/api/events]', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 })
  }
}
