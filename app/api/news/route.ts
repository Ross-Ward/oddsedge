import { NextResponse } from 'next/server'
import { getNewsArticles } from '@/lib/news'

export async function GET() {
  try {
    const articles = await getNewsArticles()
    return NextResponse.json({ success: true, data: articles, count: articles.length })
  } catch (e) {
    console.error('[/api/news]', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch news' }, { status: 500 })
  }
}
