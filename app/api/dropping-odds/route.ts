import { NextResponse } from 'next/server'
import { getDroppingOdds } from '@/lib/aggregator'

export async function GET() {
  try {
    const data = await getDroppingOdds()
    return NextResponse.json({ success: true, data, count: data.length })
  } catch (e) {
    console.error('[/api/dropping-odds]', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch dropping odds' }, { status: 500 })
  }
}
