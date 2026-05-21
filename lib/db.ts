/**
 * SQLite analysis database — persistent, time-series storage for:
 *   - odds_snapshots   : raw odds per event / bookmaker / market over time
 *   - arb_log          : arbitrage opportunities detected
 *   - value_bet_log    : value bets detected
 *   - dropping_odds_log: odds-drop events detected
 *
 * File location: <project-root>/data/oddsedge.db
 * All writes go through the helpers below; use the `db` export for
 * ad-hoc queries during analysis.
 *
 * Usage:
 *   import { logArbOpportunity, queryArb } from '@/lib/db'
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// ── Connection ───────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH  = path.join(DATA_DIR, 'oddsedge.db')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export const db = new Database(DB_PATH)

// Improve write performance; safe for single-process Node apps
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

// ── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS odds_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    captured_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    event_id        TEXT    NOT NULL,
    home_team       TEXT    NOT NULL,
    away_team       TEXT    NOT NULL,
    sport           TEXT    NOT NULL,
    commence_time   TEXT    NOT NULL,
    bookmaker_id    TEXT    NOT NULL,
    bookmaker_name  TEXT    NOT NULL,
    market          TEXT    NOT NULL DEFAULT 'h2h',
    outcome         TEXT    NOT NULL,
    odds            REAL    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_odds_event ON odds_snapshots(event_id, captured_at);
  CREATE INDEX IF NOT EXISTS idx_odds_bk    ON odds_snapshots(bookmaker_id, captured_at);

  -- ── Arbitrage log ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS arb_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    detected_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    event_id        TEXT    NOT NULL,
    home_team       TEXT    NOT NULL,
    away_team       TEXT    NOT NULL,
    sport           TEXT    NOT NULL,
    commence_time   TEXT    NOT NULL,
    profit_pct      REAL    NOT NULL,
    stake_total     REAL,
    stakes_json     TEXT    NOT NULL  -- JSON array of { bookmaker, outcome, odds, stake }
  );

  CREATE INDEX IF NOT EXISTS idx_arb_event ON arb_log(event_id, detected_at);

  -- ── Value-bet log ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS value_bet_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    detected_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    event_id        TEXT    NOT NULL,
    home_team       TEXT    NOT NULL,
    away_team       TEXT    NOT NULL,
    sport           TEXT    NOT NULL,
    commence_time   TEXT    NOT NULL,
    bookmaker_id    TEXT    NOT NULL,
    bookmaker_name  TEXT    NOT NULL,
    outcome         TEXT    NOT NULL,
    odds            REAL    NOT NULL,
    fair_odds       REAL    NOT NULL,
    ev_pct          REAL    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_vb_event ON value_bet_log(event_id, detected_at);

  -- ── Dropping-odds log ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS dropping_odds_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    detected_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    event_id        TEXT    NOT NULL,
    home_team       TEXT    NOT NULL,
    away_team       TEXT    NOT NULL,
    sport           TEXT    NOT NULL,
    commence_time   TEXT    NOT NULL,
    bookmaker_id    TEXT    NOT NULL,
    bookmaker_name  TEXT    NOT NULL,
    outcome         TEXT    NOT NULL,
    odds_before     REAL    NOT NULL,
    odds_after      REAL    NOT NULL,
    drop_pct        REAL    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_drop_event ON dropping_odds_log(event_id, detected_at);
`)

// ── Insert helpers ────────────────────────────────────────────────────────────

const insertSnapshot = db.prepare<{
  event_id: string; home_team: string; away_team: string; sport: string
  commence_time: string; bookmaker_id: string; bookmaker_name: string
  market: string; outcome: string; odds: number
}>(`
  INSERT INTO odds_snapshots
    (event_id, home_team, away_team, sport, commence_time,
     bookmaker_id, bookmaker_name, market, outcome, odds)
  VALUES
    (@event_id, @home_team, @away_team, @sport, @commence_time,
     @bookmaker_id, @bookmaker_name, @market, @outcome, @odds)
`)

const insertArb = db.prepare<{
  event_id: string; home_team: string; away_team: string; sport: string
  commence_time: string; profit_pct: number; stake_total: number | null; stakes_json: string
}>(`
  INSERT INTO arb_log
    (event_id, home_team, away_team, sport, commence_time,
     profit_pct, stake_total, stakes_json)
  VALUES
    (@event_id, @home_team, @away_team, @sport, @commence_time,
     @profit_pct, @stake_total, @stakes_json)
`)

const insertValueBet = db.prepare<{
  event_id: string; home_team: string; away_team: string; sport: string
  commence_time: string; bookmaker_id: string; bookmaker_name: string
  outcome: string; odds: number; fair_odds: number; ev_pct: number
}>(`
  INSERT INTO value_bet_log
    (event_id, home_team, away_team, sport, commence_time,
     bookmaker_id, bookmaker_name, outcome, odds, fair_odds, ev_pct)
  VALUES
    (@event_id, @home_team, @away_team, @sport, @commence_time,
     @bookmaker_id, @bookmaker_name, @outcome, @odds, @fair_odds, @ev_pct)
`)

const insertDrop = db.prepare<{
  event_id: string; home_team: string; away_team: string; sport: string
  commence_time: string; bookmaker_id: string; bookmaker_name: string
  outcome: string; odds_before: number; odds_after: number; drop_pct: number
}>(`
  INSERT INTO dropping_odds_log
    (event_id, home_team, away_team, sport, commence_time,
     bookmaker_id, bookmaker_name, outcome, odds_before, odds_after, drop_pct)
  VALUES
    (@event_id, @home_team, @away_team, @sport, @commence_time,
     @bookmaker_id, @bookmaker_name, @outcome, @odds_before, @odds_after, @drop_pct)
`)

// ── Public API ────────────────────────────────────────────────────────────────

export interface OddsSnapshotRow {
  event_id: string; home_team: string; away_team: string; sport: string
  commence_time: string; bookmaker_id: string; bookmaker_name: string
  market: string; outcome: string; odds: number
}

/** Persist a batch of odds readings (e.g. on every API poll cycle) */
export function logOddsSnapshot(rows: OddsSnapshotRow[]): void {
  const bulk = db.transaction((items: OddsSnapshotRow[]) => {
    for (const r of items) insertSnapshot.run(r)
  })
  bulk(rows)
}

export interface ArbLogRow {
  event_id: string; home_team: string; away_team: string; sport: string
  commence_time: string; profit_pct: number; stake_total?: number
  stakes: Array<{ bookmaker: string; outcome: string; odds: number; stake?: number }>
}

/** Log a detected arbitrage opportunity */
export function logArbOpportunity(row: ArbLogRow): void {
  insertArb.run({
    event_id:     row.event_id,
    home_team:    row.home_team,
    away_team:    row.away_team,
    sport:        row.sport,
    commence_time:row.commence_time,
    profit_pct:   row.profit_pct,
    stake_total:  row.stake_total ?? null,
    stakes_json:  JSON.stringify(row.stakes),
  })
}

export interface ValueBetLogRow {
  event_id: string; home_team: string; away_team: string; sport: string
  commence_time: string; bookmaker_id: string; bookmaker_name: string
  outcome: string; odds: number; fair_odds: number; ev_pct: number
}

/** Log a detected value bet */
export function logValueBet(row: ValueBetLogRow): void {
  insertValueBet.run(row)
}

export interface DroppingOddsLogRow {
  event_id: string; home_team: string; away_team: string; sport: string
  commence_time: string; bookmaker_id: string; bookmaker_name: string
  outcome: string; odds_before: number; odds_after: number; drop_pct: number
}

/** Log a detected odds drop */
export function logDroppingOdds(row: DroppingOddsLogRow): void {
  insertDrop.run(row)
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/** Recent arb opportunities, newest first */
export function queryArb(limitDays = 7, limit = 200) {
  return db.prepare(`
    SELECT * FROM arb_log
    WHERE detected_at >= datetime('now', '-' || ? || ' days')
    ORDER BY detected_at DESC
    LIMIT ?
  `).all(limitDays, limit) as (typeof insertArb extends Database.Statement<infer T, infer R> ? R : never)[]
}

/** Recent value bets with positive EV, newest first */
export function queryValueBets(minEvPct = 3, limitDays = 7, limit = 200) {
  return db.prepare(`
    SELECT * FROM value_bet_log
    WHERE ev_pct >= ?
      AND detected_at >= datetime('now', '-' || ? || ' days')
    ORDER BY ev_pct DESC, detected_at DESC
    LIMIT ?
  `).all(minEvPct, limitDays, limit)
}

/** Best bookmakers by arb frequency (for analysis / scraper prioritisation) */
export function queryArbBookmakerFrequency(limitDays = 30) {
  return db.prepare(`
    SELECT
      json_each.value ->> '$.bookmaker' AS bookmaker,
      COUNT(*) AS arb_count,
      AVG(profit_pct) AS avg_profit_pct
    FROM arb_log, json_each(arb_log.stakes_json)
    WHERE detected_at >= datetime('now', '-' || ? || ' days')
    GROUP BY bookmaker
    ORDER BY arb_count DESC
  `).all(limitDays)
}

/** Sport breakdown for detected arbs */
export function queryArbBySport(limitDays = 30) {
  return db.prepare(`
    SELECT sport, COUNT(*) AS count, AVG(profit_pct) AS avg_profit_pct
    FROM arb_log
    WHERE detected_at >= datetime('now', '-' || ? || ' days')
    GROUP BY sport
    ORDER BY count DESC
  `).all(limitDays)
}
