import { NextResponse } from 'next/server'
import { getArbOpportunities } from '@/lib/aggregator'

export async function GET() {
  try {
    const opps = await getArbOpportunities()
    return NextResponse.json({ success: true, data: opps, count: opps.length })
  } catch (e) {
    console.error('[/api/arbitrage]', e)
    return NextResponse.json({ success: false, error: 'Failed to calculate arbitrage' }, { status: 500 })
  }
}
