/**
 * The Odds API — free tier: 500 requests/month
 * https://the-odds-api.com/
 *
 * Set ODDS_API_KEY in .env.local (leave blank to use ESPN fallback only)
 */
import { BookmakerOdds, Event, Market, Sport } from './types'
import { cacheGet, cacheSet } from './cache'

const BASE = 'https://api.the-odds-api.com/v4'

const SPORT_MAP: Record<string, Sport> = {
  soccer_epl: 'soccer',
  soccer_spain_la_liga: 'soccer',
  soccer_germany_bundesliga: 'soccer',
  soccer_italy_serie_a: 'soccer',
  soccer_france_ligue_one: 'soccer',
  soccer_uefa_champs_league: 'soccer',
  basketball_nba: 'basketball',
  americanfootball_nfl: 'american_football',
  icehockey_nhl: 'hockey',
  baseball_mlb: 'baseball',
  tennis_atp_wimbledon: 'tennis',
  mma_mixed_martial_arts: 'mma',
  cricket_ipl: 'cricket',
}

const ACTIVE_SPORTS = Object.keys(SPORT_MAP)

export async function getOddsApiEvents(): Promise<Event[]> {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) return []

  const cached = cacheGet<Event[]>('odds_api_events', 180_000)
  if (cached) return cached

  const allEvents: Event[] = []

  const results = await Promise.allSettled(
    ACTIVE_SPORTS.map(async (sportKey) => {
      const url = `${BASE}/sports/${sportKey}/odds?apiKey=${apiKey}&regions=uk,eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`
      const res = await fetch(url)
      if (!res.ok) return []
      const data: any[] = await res.json()

      return data.slice(0, 10).map((g): Event => ({
        id: `odds_${g.id}`,
        sport: SPORT_MAP[sportKey] ?? 'soccer',
        sportTitle: g.sport_title ?? sportKey,
        league: g.sport_title ?? sportKey,
        commenceTime: g.commence_time,
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        isLive: false,
        bookmakers: (g.bookmakers ?? []).map((bk: any): BookmakerOdds => ({
          key: bk.key,
          title: bk.title,
          lastUpdate: bk.last_update,
          markets: (bk.markets ?? []).map((m: any): Market => ({
            key: m.key,
            label: m.key === 'h2h' ? 'Match Result' : m.key === 'totals' ? 'Over/Under' : m.key,
            outcomes: m.outcomes.map((o: any) => ({ name: o.name, price: o.price })),
          })),
        })),
      }))
    })
  )

  for (const r of results) {
    if (r.status === 'fulfilled') allEvents.push(...r.value)
  }

  cacheSet('odds_api_events', allEvents)
  return allEvents
}
