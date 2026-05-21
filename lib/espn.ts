/**
 * ESPN Public Scoreboard API (no API key needed)
 * Gives us real game data for major leagues — schedule, scores, status.
 * We do NOT generate fake odds here; real odds come from scrapers/OddsAPI.
 */
import { Event, Sport } from './types'

const ESPN_CONFIGS = [
  // ── Soccer ──────────────────────────────────────────────────────────────
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'eng.1',          title: 'Premier League' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'eng.2',          title: 'Championship' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'esp.1',          title: 'La Liga' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'ger.1',          title: 'Bundesliga' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'ita.1',          title: 'Serie A' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'fra.1',          title: 'Ligue 1' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'por.1',          title: 'Primeira Liga' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'ned.1',          title: 'Eredivisie' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'sco.1',          title: 'Scottish Premiership' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'usa.1',          title: 'MLS' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'mex.1',          title: 'Liga MX' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'bra.1',          title: 'Brasileirao' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'arg.1',          title: 'Argentine Primera' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'uefa.champions', title: 'Champions League' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'uefa.europa',    title: 'Europa League' },
  { sport: 'soccer' as Sport, espnSport: 'soccer', league: 'eng.fa',         title: 'FA Cup' },
  // ── American Football ────────────────────────────────────────────────────
  { sport: 'american_football' as Sport, espnSport: 'football', league: 'nfl',            title: 'NFL' },
  { sport: 'american_football' as Sport, espnSport: 'football', league: 'college-football', title: 'NCAAF' },
  // ── Basketball ───────────────────────────────────────────────────────────
  { sport: 'basketball' as Sport, espnSport: 'basketball', league: 'nba',                    title: 'NBA' },
  { sport: 'basketball' as Sport, espnSport: 'basketball', league: 'womens-college-basketball', title: 'WNBA' },
  { sport: 'basketball' as Sport, espnSport: 'basketball', league: 'mens-college-basketball',   title: 'NCAA Basketball' },
  // ── Baseball ─────────────────────────────────────────────────────────────
  { sport: 'baseball' as Sport, espnSport: 'baseball', league: 'mlb', title: 'MLB' },
  // ── Ice Hockey ───────────────────────────────────────────────────────────
  { sport: 'hockey' as Sport, espnSport: 'hockey', league: 'nhl', title: 'NHL' },
  // ── Rugby ─────────────────────────────────────────────────────────────────
  { sport: 'rugby' as Sport, espnSport: 'rugby-union', league: 'premiership', title: 'Premiership Rugby' },
  { sport: 'rugby' as Sport, espnSport: 'rugby-union', league: 'six.nations',  title: 'Six Nations' },
  // ── Cricket ──────────────────────────────────────────────────────────────
  { sport: 'cricket' as Sport, espnSport: 'cricket', league: 'ipl', title: 'IPL' },
  // ── Tennis ───────────────────────────────────────────────────────────────
  { sport: 'tennis' as Sport, espnSport: 'tennis', league: 'atp', title: 'ATP Tour' },
]



export interface ESPNGameDetail {
  statusState: 'pre' | 'in' | 'post' | 'unknown'
  statusDetail: string    // e.g. "9/13 - 6:00 PM EDT" or "Final" or "1st Quarter - 4:32"
  homeScore?: string
  awayScore?: string
  homeRecord?: string     // e.g. "5-2"
  awayRecord?: string
  venue?: string
  broadcast?: string      // TV channel
}

/** Extended Event with ESPN enrichment data */
export type ESPNEvent = Event & { espn?: ESPNGameDetail }

export async function getESPNEvents(): Promise<ESPNEvent[]> {
  const allEvents: ESPNEvent[] = []

  const results = await Promise.allSettled(
    ESPN_CONFIGS.map(async (cfg) => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.espnSport}/${cfg.league}/scoreboard`
      const res = await fetch(url, {
        next: { revalidate: 300 },
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (!res.ok) return []
      const data = await res.json()
      if (!Array.isArray(data?.events)) return []

      return data.events.slice(0, 15).map((game: any): ESPNEvent => {
        const comp = game.competitions?.[0]
        const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
        const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
        const status = comp?.status
        const stateStr: string = status?.type?.state ?? 'unknown'
        const state = (stateStr === 'pre' || stateStr === 'in' || stateStr === 'post') ? stateStr : 'unknown'

        const espn: ESPNGameDetail = {
          statusState: state,
          statusDetail: status?.type?.shortDetail ?? status?.type?.description ?? '',
          homeScore: state !== 'pre' ? (home?.score ?? undefined) : undefined,
          awayScore: state !== 'pre' ? (away?.score ?? undefined) : undefined,
          homeRecord: home?.records?.[0]?.summary ?? undefined,
          awayRecord: away?.records?.[0]?.summary ?? undefined,
          venue: comp?.venue?.fullName ?? undefined,
          broadcast: comp?.broadcasts?.[0]?.names?.[0] ?? undefined,
        }

        return {
          id: `espn_${cfg.league}_${game.id}`,
          sport: cfg.sport,
          sportTitle: cfg.title,
          league: cfg.title,
          commenceTime: game.date ?? new Date().toISOString(),
          homeTeam: home?.team?.displayName ?? 'Home Team',
          awayTeam: away?.team?.displayName ?? 'Away Team',
          isLive: state === 'in',
          bookmakers: [], // ESPN provides schedule only; odds come from scrapers/OddsAPI
          espn,
        }
      })
    })
  )

  for (const r of results) {
    if (r.status === 'fulfilled') allEvents.push(...r.value)
  }

  return allEvents
}
