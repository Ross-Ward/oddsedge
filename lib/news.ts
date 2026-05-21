/**
 * Sports news from free RSS feeds.
 * Sources: BBC Sport, ESPN, Sky Sports, The Guardian, and sport-specific feeds.
 */
import { NewsArticle, BettingImpact } from './types'
import { cacheGet, cacheSet } from './cache'

interface FeedConfig {
  url: string
  source: string
  sport?: string // undefined = general
}

const RSS_FEEDS: FeedConfig[] = [
  // ── General ────────────────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml',            source: 'BBC Sport' },
  { url: 'https://www.espn.com/espn/rss/news',                source: 'ESPN' },
  { url: 'https://www.skysports.com/rss/12040',               source: 'Sky Sports' },
  { url: 'https://www.theguardian.com/sport/rss',             source: 'The Guardian' },
  // ── Soccer / Football ──────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',  source: 'BBC Sport',     sport: 'soccer' },
  { url: 'https://www.skysports.com/rss/11095',               source: 'Sky Sports',    sport: 'soccer' },
  { url: 'https://www.theguardian.com/football/rss',         source: 'The Guardian',  sport: 'soccer' },
  { url: 'https://www.espn.com/espn/rss/soccer/news',        source: 'ESPN',          sport: 'soccer' },
  // ── American Football (NFL) ────────────────────────────────────────────────
  { url: 'https://www.espn.com/espn/rss/nfl/news',           source: 'ESPN',          sport: 'american_football' },
  { url: 'https://feeds.bbci.co.uk/sport/american-football/rss.xml', source: 'BBC Sport', sport: 'american_football' },
  // ── Basketball (NBA) ───────────────────────────────────────────────────────
  { url: 'https://www.espn.com/espn/rss/nba/news',           source: 'ESPN',          sport: 'basketball' },
  // ── Baseball (MLB) ─────────────────────────────────────────────────────────
  { url: 'https://www.espn.com/espn/rss/mlb/news',           source: 'ESPN',          sport: 'baseball' },
  // ── Ice Hockey (NHL) ───────────────────────────────────────────────────────
  { url: 'https://www.espn.com/espn/rss/nhl/news',           source: 'ESPN',          sport: 'hockey' },
  // ── Tennis ────────────────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml',   source: 'BBC Sport',     sport: 'tennis' },
  { url: 'https://www.skysports.com/rss/12548',              source: 'Sky Sports',    sport: 'tennis' },
  // ── Cricket ───────────────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml',  source: 'BBC Sport',     sport: 'cricket' },
  { url: 'https://www.skysports.com/rss/12045',              source: 'Sky Sports',    sport: 'cricket' },
  // ── Boxing / MMA ──────────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/sport/boxing/rss.xml',   source: 'BBC Sport',     sport: 'mma' },
  { url: 'https://www.mmafighting.com/rss/current',          source: 'MMA Fighting',  sport: 'mma' },
  { url: 'https://www.espn.com/espn/rss/boxing/news',        source: 'ESPN',          sport: 'mma' },
  // ── Golf ──────────────────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/sport/golf/rss.xml',     source: 'BBC Sport',     sport: 'golf' },
  { url: 'https://www.espn.com/espn/rss/golf/news',         source: 'ESPN',          sport: 'golf' },
  // ── Motorsport / F1 ───────────────────────────────────────────────────────
  { url: 'https://www.motorsport.com/rss/f1/news/',          source: 'Motorsport.com', sport: 'motorsport' },
  { url: 'https://www.skysports.com/rss/12516',              source: 'Sky Sports',    sport: 'motorsport' },
  // ── Rugby ─────────────────────────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/sport/rugby-union/rss.xml', source: 'BBC Sport',  sport: 'rugby' },
  { url: 'https://www.skysports.com/rss/12064',              source: 'Sky Sports',    sport: 'rugby' },
  // ── Horse Racing ──────────────────────────────────────────────────────────
  { url: 'https://www.skysports.com/rss/12629',              source: 'Sky Sports',    sport: 'horse_racing' },
  { url: 'https://feeds.bbci.co.uk/sport/horse-racing/rss.xml', source: 'BBC Sport', sport: 'horse_racing' },
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!match) return ''
  return stripHtml((match[1] || match[2] || '').trim())
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i'))
  return match ? match[1] : ''
}

async function parseFeed(feed: FeedConfig): Promise<NewsArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OddsEdge/1.0)' },
      next: { revalidate: 600 },
    })
    if (!res.ok) return []
    const xml = await res.text()

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi
    const articles: NewsArticle[] = []
    let match: RegExpExecArray | null

    while ((match = itemRegex.exec(xml)) !== null && articles.length < 8) {
      const item = match[1]
      const title = extractTag(item, 'title')
      const link = extractTag(item, 'link')
      const desc = extractTag(item, 'description')
      const pubDate = extractTag(item, 'pubDate')
      const imgUrl =
        extractAttr(item, 'media:thumbnail', 'url') ||
        extractAttr(item, 'media:content', 'url') ||
        item.match(/<img[^>]*src="([^"]+)"/i)?.[1] ||
        undefined

      if (!title || !link) continue

      // Detect sport from title/description if not set by feed config
      const sport = feed.sport ?? detectSportFromText(title + ' ' + desc)

      articles.push({
        id: Buffer.from(link).toString('base64'),
        title,
        summary: desc.slice(0, 200),
        url: link,
        imageUrl: imgUrl,
        source: feed.source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        sport,
        bettingImpact: classifyBettingImpact(title, desc),
      })
    }

    return articles
  } catch {
    return []
  }
}

/** Best-effort sport detection from article text */
function detectSportFromText(text: string): string | undefined {
  const t = text.toLowerCase()
  if (/\bnfl\b|quarterback|touchdown|superbowl|american football/.test(t)) return 'american_football'
  if (/\bnba\b|\bnbl\b|basketball|lakers|celtics|warriors/.test(t)) return 'basketball'
  if (/\bmlb\b|baseball|world series|home run/.test(t)) return 'baseball'
  if (/\bnhl\b|ice hockey|stanley cup/.test(t)) return 'hockey'
  if (/\bformula.?1\b|\bf1\b|grand prix|ferrari|mercedes|red bull racing/.test(t)) return 'motorsport'
  if (/\bufc\b|\bmma\b|boxing|knockout|k\.o\.|welterweight|heavyweight/.test(t)) return 'mma'
  if (/\btennis\b|wimbledon|\batp\b|\bwta\b|roland garros|us open/.test(t)) return 'tennis'
  if (/\bcricket\b|\bipl\b|test match|odi|t20/.test(t)) return 'cricket'
  if (/\bgolf\b|pga tour|masters|ryder cup/.test(t)) return 'golf'
  if (/\brugby\b|six nations|premiership rugby/.test(t)) return 'rugby'
  if (/horse racing|jockey|cheltenham|royal ascot/.test(t)) return 'horse_racing'
  if (/premier league|la liga|bundesliga|serie a|ligue 1|champions league|fa cup|euro|world cup/.test(t)) return 'soccer'
  return undefined
}

/** Classify the betting relevance of an article from its title + summary.
 * Exported for unit testing. */
export function classifyBettingImpact(title: string, summary: string): BettingImpact | undefined {
  const t = (title + ' ' + summary).toLowerCase()

  // Priority order: most specific first
  if (/\binjur(y|ies|ed)\b|ruled out|sitting out|out with|sidelined|fitness concern|fitness doubt|muscle|hamstring|knee|ankle|concussion|out for|back issue|calf|shoulder|wrist|fracture|sprain/.test(t)) {
    return { tag: 'injury', label: '🤕 Injury News', hint: 'Player absence can shift match odds & team-selection markets.' }
  }
  if (/\bsuspend(ed|sion)\b|\bban(ned)?\b|\bred card\b|disciplinary|yellow card accumulation/.test(t)) {
    return { tag: 'suspension', label: '🟥 Suspension', hint: 'Key player suspended — expect lines to move before kick-off.' }
  }
  if (/\bsack(ed)?\b|resign(ed|s)?\b|appointed|new (head )?coach|new manager|managerial/.test(t)) {
    return { tag: 'manager', label: '🧑‍💼 Manager Change', hint: 'Managerial change brings uncertainty — markets may widen.' }
  }
  if (/\btransfer(red)?\b|signing|signs for|joins|new contract|released|loan deal|sell|sold|fee agreed/.test(t)) {
    return { tag: 'transfer', label: '🔄 Transfer', hint: 'Squad reinforcement or loss affects future outright prices.' }
  }
  if (/\blineup\b|starting (xi|eleven|team)|team news|squad|selection|confirmed (team|squad)/.test(t)) {
    return { tag: 'team_news', label: '📋 Team News', hint: 'Confirmed team sheet — good time to check pre-match lines.' }
  }
  if (/\bweather\b|postponed|called off|cancelled|waterlogged|heavy rain|strong winds|snow|frost|pitch inspection/.test(t)) {
    return { tag: 'weather', label: '🌧️ Conditions', hint: 'Adverse conditions can favour under-goals & defensive markets.' }
  }
  if (/\bodds\b|favourite|market|betting|backed|price (cut|slashed|drifts?)|bookmaker|ante-post/.test(t)) {
    return { tag: 'odds_movement', label: '📈 Odds Move', hint: 'Active market movement reported — check for sharp money.' }
  }
  if (/\bwinning streak\b|unbeaten|on form|poor form|losing streak|momentum|confidence/.test(t)) {
    return { tag: 'form', label: '📊 Form Guide', hint: 'Form runs factor into pre-match probability models.' }
  }
  if (/\bbeats?\b|defeats?\b|thrashes?\b|\bwins?\b|\bdraws?\b|result|final score|scoreline/.test(t)) {
    return { tag: 'result', label: '🏆 Result', hint: 'Recent result shapes current form — watch for line adjustments.' }
  }

  return undefined
}

export async function getNewsArticles(): Promise<NewsArticle[]> {
  const cached = cacheGet<NewsArticle[]>('news_articles_v2', 600_000)
  if (cached) return cached

  const results = await Promise.allSettled(RSS_FEEDS.map(parseFeed))
  const all: NewsArticle[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  // Sort newest first
  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  cacheSet('news_articles_v2', all)
  return all
}
