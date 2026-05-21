export type Sport =
  // Team sports
  | 'soccer' | 'basketball' | 'tennis' | 'hockey' | 'baseball'
  | 'american_football' | 'mma' | 'cricket' | 'rugby' | 'golf'
  // Racing
  | 'horse_racing' | 'greyhound_racing' | 'motorsport'
  // Esports
  | 'esports'
  // Prediction / financial markets
  | 'prediction_market'

/** Broad category used to group non-standard event types */
export type EventCategory =
  | 'sport' | 'horse_racing' | 'greyhound_racing' | 'esports'
  | 'politics' | 'finance' | 'crypto' | 'entertainment' | 'science'
  | 'lottery' | 'climate' | 'pop_culture'

export interface Outcome {
  name: string
  price: number // decimal odds
}

export interface Market {
  key: string // 'h2h' | 'spreads' | 'totals' | 'winner' | 'outright'
  label: string
  outcomes: Outcome[]
}

export interface BookmakerOdds {
  key: string
  title: string
  logo?: string
  lastUpdate: string
  markets: Market[]
}

export interface Event {
  id: string
  sport: Sport
  sportTitle: string
  league: string
  commenceTime: string
  homeTeam: string
  awayTeam: string
  isLive: boolean
  bookmakers: BookmakerOdds[]
  // Optional enrichment fields
  category?: EventCategory  // used for prediction markets / races
  question?: string         // full question text (Kalshi / Polymarket)
  volume?: number           // liquidity / trade volume (prediction markets)
  runners?: number          // number of runners (horse / greyhound races)
}

export interface ArbOpportunity {
  id: string
  event: Event
  market: string
  marketLabel: string
  profitPct: number // e.g. 2.3 means 2.3%
  stakes: ArbStake[]
  totalImpliedProbability: number // should be < 1
  fetchedAt: string
}

export interface ArbStake {
  bookmaker: string
  bookmakerTitle: string
  outcome: string
  odds: number
  stakePercent: number // % of bankroll to place here
  stakeAmount: number  // for £100 bankroll
  returns: number
}

export interface DroppingOdds {
  id: string
  event: Event
  bookmaker: string
  bookmakerTitle: string
  outcome: string
  market: string
  previousOdds: number
  currentOdds: number
  changePct: number // negative = dropping
  droppedAt: string
}

export type BettingImpactTag =
  | 'injury'
  | 'suspension'
  | 'team_news'
  | 'transfer'
  | 'manager'
  | 'form'
  | 'weather'
  | 'result'
  | 'odds_movement'

export interface BettingImpact {
  tag: BettingImpactTag
  /** Short label shown on the badge, e.g. "Injury News" */
  label: string
  /** One-line market implication, e.g. "Expect match-odds movement" */
  hint: string
}

export interface NewsArticle {
  id: string
  title: string
  summary: string
  url: string
  imageUrl?: string
  source: string
  publishedAt: string
  sport?: string
  /** Betting-relevance classification derived from article text */
  bettingImpact?: BettingImpact
}

export interface OddsSnapshot {
  eventId: string
  bookmaker: string
  outcome: string
  market: string
  odds: number
  timestamp: string
}
