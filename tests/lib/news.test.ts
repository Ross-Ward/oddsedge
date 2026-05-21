/**
 * News betting-impact classifier tests
 *
 * Use cases covered:
 *   UC-NEWS-1  Injury articles are classified and given the correct market hint
 *   UC-NEWS-2  Suspension / red-card articles are classified
 *   UC-NEWS-3  Transfer / signing articles are classified
 *   UC-NEWS-4  Manager change articles are classified
 *   UC-NEWS-5  Confirmed lineup / team-news articles are classified
 *   UC-NEWS-6  Odds-movement / bookmaker articles are classified
 *   UC-NEWS-7  Form / streak articles are classified
 *   UC-NEWS-8  Weather / postponement articles are classified
 *   UC-NEWS-9  Match result articles are classified
 *   UC-NEWS-10 Genuinely generic articles return undefined (no false positives)
 *   UC-NEWS-11 Classification uses both title and summary text
 *   UC-NEWS-12 Priority ordering: injury takes precedence over result
 */

import { describe, it, expect } from 'vitest'
import { classifyBettingImpact } from '@/lib/news'

// ── UC-NEWS-1: injury ─────────────────────────────────────────────────────────

describe('classifyBettingImpact — injury', () => {
  it('classifies "ruled out" headlines as injury', () => {
    const result = classifyBettingImpact('Star striker ruled out for six weeks', '')
    expect(result?.tag).toBe('injury')
  })

  it('classifies "hamstring" headlines as injury', () => {
    const result = classifyBettingImpact('Midfielder picks up hamstring problem in training', '')
    expect(result?.tag).toBe('injury')
  })

  it('classifies "sitting out" as injury', () => {
    const result = classifyBettingImpact("Player sitting out vs rival with back issue", '')
    expect(result?.tag).toBe('injury')
  })

  it('classifies "knee" as injury', () => {
    const result = classifyBettingImpact('Defender misses match with knee concern', '')
    expect(result?.tag).toBe('injury')
  })

  it('classifies "out with" as injury', () => {
    const result = classifyBettingImpact('Captain out with calf problem ahead of derby', '')
    expect(result?.tag).toBe('injury')
  })

  it('includes a market hint in the result', () => {
    const result = classifyBettingImpact('Striker ruled out for three weeks with ankle injury', '')
    expect(result?.hint).toBeTruthy()
    expect(result?.hint.length).toBeGreaterThan(10)
  })
})

// ── UC-NEWS-2: suspension ─────────────────────────────────────────────────────

describe('classifyBettingImpact — suspension', () => {
  it('classifies "suspended" headlines', () => {
    const result = classifyBettingImpact('Captain suspended for derby after yellow card accumulation', '')
    expect(result?.tag).toBe('suspension')
  })

  it('classifies "red card" ban headlines', () => {
    const result = classifyBettingImpact('Player banned after red card appeal rejected', '')
    expect(result?.tag).toBe('suspension')
  })

  it('classifies "disciplinary" articles', () => {
    const result = classifyBettingImpact('', 'Disciplinary hearing scheduled following incident')
    expect(result?.tag).toBe('suspension')
  })
})

// ── UC-NEWS-3: transfer ───────────────────────────────────────────────────────

describe('classifyBettingImpact — transfer', () => {
  it('classifies transfer headlines', () => {
    const result = classifyBettingImpact('Club completes record transfer for striker', '')
    expect(result?.tag).toBe('transfer')
  })

  it('classifies "signs for" headlines', () => {
    const result = classifyBettingImpact('World-class midfielder signs for Premier League giants', '')
    expect(result?.tag).toBe('transfer')
  })

  it('classifies "fee agreed" headlines', () => {
    const result = classifyBettingImpact('', 'Fee agreed for defender as club confirms deal')
    expect(result?.tag).toBe('transfer')
  })

  it('classifies "loan deal" articles', () => {
    const result = classifyBettingImpact('Winger joins on season-long loan deal', '')
    expect(result?.tag).toBe('transfer')
  })
})

// ── UC-NEWS-4: manager change ─────────────────────────────────────────────────

describe('classifyBettingImpact — manager', () => {
  it('classifies "sacked" headlines', () => {
    const result = classifyBettingImpact('Manager sacked after poor run of form', '')
    expect(result?.tag).toBe('manager')
  })

  it('classifies "appointed" headlines', () => {
    const result = classifyBettingImpact('New head coach appointed with immediate effect', '')
    expect(result?.tag).toBe('manager')
  })

  it('classifies "resigned" headlines', () => {
    const result = classifyBettingImpact('Head coach resigned following board meeting', '')
    expect(result?.tag).toBe('manager')
  })
})

// ── UC-NEWS-5: team news / lineup ─────────────────────────────────────────────

describe('classifyBettingImpact — team news', () => {
  it('classifies "confirmed lineup" articles', () => {
    const result = classifyBettingImpact('Confirmed lineup revealed ahead of Champions League tie', '')
    expect(result?.tag).toBe('team_news')
  })

  it('classifies "starting XI" articles', () => {
    const result = classifyBettingImpact('Starting XI announced for tonight\'s match', '')
    expect(result?.tag).toBe('team_news')
  })

  it('classifies "team news" articles', () => {
    const result = classifyBettingImpact('Team news: key changes expected for weekend fixture', '')
    expect(result?.tag).toBe('team_news')
  })
})

// ── UC-NEWS-6: odds movement ──────────────────────────────────────────────────

describe('classifyBettingImpact — odds movement', () => {
  it('classifies "bookmaker" articles', () => {
    const result = classifyBettingImpact('Bookmaker slashes odds ahead of title clash', '')
    expect(result?.tag).toBe('odds_movement')
  })

  it('classifies "price cut" articles', () => {
    const result = classifyBettingImpact('Favourite sees odds price cut following training report', '')
    expect(result?.tag).toBe('odds_movement')
  })

  it('classifies "betting" articles', () => {
    // Avoid the word "news" which triggers team_news first
    const result = classifyBettingImpact('Betting market backs favourite ahead of fixture', '')
    expect(result?.tag).toBe('odds_movement')
  })
})

// ── UC-NEWS-7: form ───────────────────────────────────────────────────────────

describe('classifyBettingImpact — form', () => {
  it('classifies "winning streak" articles', () => {
    const result = classifyBettingImpact('Club extends winning streak to eight games', '')
    expect(result?.tag).toBe('form')
  })

  it('classifies "unbeaten" articles', () => {
    const result = classifyBettingImpact('Team remains unbeaten in the league this season', '')
    expect(result?.tag).toBe('form')
  })
})

// ── UC-NEWS-8: weather / conditions ──────────────────────────────────────────

describe('classifyBettingImpact — weather', () => {
  it('classifies "postponed" articles', () => {
    const result = classifyBettingImpact('Match postponed due to waterlogged pitch', '')
    expect(result?.tag).toBe('weather')
  })

  it('classifies "heavy rain" articles', () => {
    const result = classifyBettingImpact('', 'Heavy rain forecast ahead of evening kick-off')
    expect(result?.tag).toBe('weather')
  })
})

// ── UC-NEWS-9: result ─────────────────────────────────────────────────────────

describe('classifyBettingImpact — result', () => {
  it('classifies "beats" result headlines', () => {
    const result = classifyBettingImpact('City beats United 3-1 in thrilling derby', '')
    expect(result?.tag).toBe('result')
  })

  it('classifies "final score" articles', () => {
    const result = classifyBettingImpact('Final score: Arsenal 2-0 Spurs', '')
    expect(result?.tag).toBe('result')
  })
})

// ── UC-NEWS-10: no false positives ────────────────────────────────────────────

describe('classifyBettingImpact — generic articles', () => {
  it('returns undefined for a generic post-match interview article', () => {
    const result = classifyBettingImpact(
      'Manager gives thoughtful assessment of tactical approach',
      'The manager spoke at length about the team\'s philosophy and development plans.'
    )
    expect(result).toBeUndefined()
  })

  it('returns undefined for a fixture announcement article', () => {
    const result = classifyBettingImpact(
      'Premier League confirms television schedule for March',
      'Sky Sports and BBC have acquired the broadcast rights.'
    )
    expect(result).toBeUndefined()
  })
})

// ── UC-NEWS-11: uses both title and summary ───────────────────────────────────

describe('classifyBettingImpact — title + summary combined', () => {
  it('picks up injury keyword from summary when title is generic', () => {
    const result = classifyBettingImpact(
      'Pre-match update from the club',
      'The club confirmed the striker is ruled out due to a hamstring problem.'
    )
    expect(result?.tag).toBe('injury')
  })
})

// ── UC-NEWS-12: priority order ────────────────────────────────────────────────

describe('classifyBettingImpact — priority ordering', () => {
  it('returns injury when both injury and result keywords are present', () => {
    const result = classifyBettingImpact(
      'Arsenal beats Chelsea but loses striker to injury',
      'The player was ruled out after sustaining a hamstring problem.'
    )
    // Injury should take priority over result
    expect(result?.tag).toBe('injury')
  })

  it('returns suspension over transfer when both are present', () => {
    const result = classifyBettingImpact(
      'Suspended midfielder completes transfer to rival club',
      ''
    )
    expect(result?.tag).toBe('suspension')
  })
})
