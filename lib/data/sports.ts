/**
 * Canonical sports taxonomy used across OddsEdge for filtering,
 * classification and display.
 *
 * Usage:
 *   import { SPORTS, SPORT_CATEGORIES, getSport } from '@/lib/data/sports'
 */

export type SportCategory =
  | 'major_team'
  | 'racing_combat'
  | 'racket'
  | 'winter_water'
  | 'cycling_athletics'
  | 'niche_ball'
  | 'target_precision'
  | 'combat_martial'
  | 'equestrian_strength'
  | 'esports'
  | 'action'
  | 'recreational'
  | 'indoor_country'

export interface Sport {
  id: string           // machine key, snake_case
  name: string         // display name
  category: SportCategory
  emoji: string
  /** keys used by the-odds-api / scrapers for this sport */
  scraperKeys?: string[]
}

export const SPORTS: Sport[] = [
  // ── Major Global & Team Sports ───────────────────────────────────────────
  { id: 'soccer',           name: 'Football (Soccer)',            category: 'major_team',        emoji: '⚽', scraperKeys: ['soccer'] },
  { id: 'basketball',       name: 'Basketball (NBA/EuroLeague)',  category: 'major_team',        emoji: '🏀', scraperKeys: ['basketball_nba', 'basketball_euroleague', 'basketball_fiba'] },
  { id: 'american_football',name: 'American Football (NFL/NCAA)', category: 'major_team',        emoji: '🏈', scraperKeys: ['americanfootball_nfl', 'americanfootball_ncaaf'] },
  { id: 'cricket',          name: 'Cricket (Test/T20/WC)',        category: 'major_team',        emoji: '🏏', scraperKeys: ['cricket'] },
  { id: 'rugby_union',      name: 'Rugby Union',                  category: 'major_team',        emoji: '🏉', scraperKeys: ['rugbyunion'] },
  { id: 'rugby_league',     name: 'Rugby League',                 category: 'major_team',        emoji: '🏉', scraperKeys: ['rugbyleague'] },
  { id: 'ice_hockey',       name: 'Ice Hockey (NHL)',             category: 'major_team',        emoji: '🏒', scraperKeys: ['icehockey_nhl'] },
  { id: 'baseball',         name: 'Baseball (MLB)',               category: 'major_team',        emoji: '⚾', scraperKeys: ['baseball_mlb'] },
  { id: 'volleyball',       name: 'Volleyball',                   category: 'major_team',        emoji: '🏐' },
  { id: 'afl',              name: 'Australian Rules Football',    category: 'major_team',        emoji: '🏉', scraperKeys: ['aussierules_afl'] },
  { id: 'gaelic_games',     name: 'Gaelic Games (GAA)',           category: 'major_team',        emoji: '🟢' },

  // ── Racing & Combat Sports ───────────────────────────────────────────────
  { id: 'horse_racing',     name: 'Horse Racing',                 category: 'racing_combat',     emoji: '🐎', scraperKeys: ['horse_racing'] },
  { id: 'formula1',         name: 'Formula 1 & Motorsports',      category: 'racing_combat',     emoji: '🏎️' },
  { id: 'boxing',           name: 'Boxing',                       category: 'racing_combat',     emoji: '🥊', scraperKeys: ['boxing'] },
  { id: 'mma',              name: 'MMA / UFC',                    category: 'racing_combat',     emoji: '🥋', scraperKeys: ['mma'] },
  { id: 'greyhound',        name: 'Greyhound Racing',             category: 'racing_combat',     emoji: '🐕' },

  // ── Racket Sports ────────────────────────────────────────────────────────
  { id: 'tennis',           name: 'Tennis (ATP/WTA/Grand Slams)', category: 'racket',            emoji: '🎾', scraperKeys: ['tennis'] },
  { id: 'table_tennis',     name: 'Table Tennis',                 category: 'racket',            emoji: '🏓' },
  { id: 'badminton',        name: 'Badminton',                    category: 'racket',            emoji: '🏸' },
  { id: 'golf',             name: 'Golf (PGA/DP World Tour)',     category: 'racket',            emoji: '⛳', scraperKeys: ['golf'] },
  { id: 'squash',           name: 'Squash',                       category: 'racket',            emoji: '🎾' },

  // ── Winter & Water Sports ────────────────────────────────────────────────
  { id: 'alpine_skiing',    name: 'Alpine Skiing',                category: 'winter_water',      emoji: '⛷️' },
  { id: 'biathlon',         name: 'Biathlon',                     category: 'winter_water',      emoji: '🎿' },
  { id: 'ski_jumping',      name: 'Ski Jumping',                  category: 'winter_water',      emoji: '🎿' },
  { id: 'bobsleigh',        name: 'Bobsleigh',                    category: 'winter_water',      emoji: '🛷' },
  { id: 'figure_skating',   name: 'Figure Skating',               category: 'winter_water',      emoji: '⛸️' },
  { id: 'curling',          name: 'Curling',                      category: 'winter_water',      emoji: '🥌' },
  { id: 'swimming',         name: 'Swimming',                     category: 'winter_water',      emoji: '🏊' },
  { id: 'water_polo',       name: 'Water Polo',                   category: 'winter_water',      emoji: '🤽' },
  { id: 'rowing',           name: 'Rowing',                       category: 'winter_water',      emoji: '🚣' },
  { id: 'sailing',          name: 'Sailing',                      category: 'winter_water',      emoji: '⛵' },

  // ── Cycling & Athletics ──────────────────────────────────────────────────
  { id: 'track_cycling',    name: 'Track Cycling',                category: 'cycling_athletics', emoji: '🚴' },
  { id: 'road_cycling',     name: 'Road Cycling (Tour de France)',category: 'cycling_athletics', emoji: '🚴' },
  { id: 'marathon',         name: 'Marathon Running',             category: 'cycling_athletics', emoji: '🏃' },
  { id: 'track_field',      name: 'Track and Field',              category: 'cycling_athletics', emoji: '🏅' },
  { id: 'triathlon',        name: 'Triathlon',                    category: 'cycling_athletics', emoji: '🏊' },
  { id: 'cross_country',    name: 'Cross Country',                category: 'cycling_athletics', emoji: '🏃' },

  // ── Niche & Ball Sports ──────────────────────────────────────────────────
  { id: 'handball',         name: 'Handball',                     category: 'niche_ball',        emoji: '🤾' },
  { id: 'field_hockey',     name: 'Field Hockey',                 category: 'niche_ball',        emoji: '🏑' },
  { id: 'iihf',             name: 'Ice Hockey (IIHF)',            category: 'niche_ball',        emoji: '🏒' },
  { id: 'bandy',            name: 'Bandy',                        category: 'niche_ball',        emoji: '🏒' },
  { id: 'floorball',        name: 'Floorball',                    category: 'niche_ball',        emoji: '🏑' },
  { id: 'futsal',           name: 'Futsal',                       category: 'niche_ball',        emoji: '⚽' },
  { id: 'beach_volleyball', name: 'Beach Volleyball',             category: 'niche_ball',        emoji: '🏐' },
  { id: 'netball',          name: 'Netball',                      category: 'niche_ball',        emoji: '🏀' },
  { id: 'lacrosse',         name: 'Lacrosse',                     category: 'niche_ball',        emoji: '🥍' },
  { id: 'gaelic_handball',  name: 'Gaelic Handball',              category: 'niche_ball',        emoji: '🟢' },

  // ── Target & Precision Sports ────────────────────────────────────────────
  { id: 'darts',            name: 'Darts',                        category: 'target_precision',  emoji: '🎯', scraperKeys: ['darts'] },
  { id: 'snooker',          name: 'Snooker',                      category: 'target_precision',  emoji: '🎱' },
  { id: 'pool',             name: 'Pool',                         category: 'target_precision',  emoji: '🎱' },
  { id: 'billiards',        name: 'Billiards',                    category: 'target_precision',  emoji: '🎱' },
  { id: 'bowling',          name: 'Ten-Pin Bowling',              category: 'target_precision',  emoji: '🎳' },
  { id: 'lawn_bowls',       name: 'Lawn Bowls',                   category: 'target_precision',  emoji: '🥌' },
  { id: 'archery',          name: 'Archery',                      category: 'target_precision',  emoji: '🏹' },
  { id: 'shooting',         name: 'Shooting',                     category: 'target_precision',  emoji: '🔫' },

  // ── Combat & Martial Arts ────────────────────────────────────────────────
  { id: 'judo',             name: 'Judo',                         category: 'combat_martial',    emoji: '🥋' },
  { id: 'taekwondo',        name: 'Taekwondo',                    category: 'combat_martial',    emoji: '🥋' },
  { id: 'karate',           name: 'Karate',                       category: 'combat_martial',    emoji: '🥋' },
  { id: 'wrestling',        name: 'Wrestling (Freestyle/Greco)',   category: 'combat_martial',    emoji: '🤼' },
  { id: 'pro_wrestling',    name: 'WWE / Pro Wrestling',          category: 'combat_martial',    emoji: '🤼' },
  { id: 'sumo',             name: 'Sumo Wrestling',               category: 'combat_martial',    emoji: '🤼' },
  { id: 'kickboxing',       name: 'Kickboxing',                   category: 'combat_martial',    emoji: '🥊' },
  { id: 'muay_thai',        name: 'Muay Thai',                    category: 'combat_martial',    emoji: '🥊' },

  // ── Equestrian & Strength Sports ─────────────────────────────────────────
  { id: 'show_jumping',     name: 'Show Jumping',                 category: 'equestrian_strength',emoji: '🐎' },
  { id: 'dressage',         name: 'Dressage',                     category: 'equestrian_strength',emoji: '🐎' },
  { id: 'eventing',         name: 'Eventing',                     category: 'equestrian_strength',emoji: '🐎' },
  { id: 'polo',             name: 'Polo',                         category: 'equestrian_strength',emoji: '🐎' },
  { id: 'weightlifting',    name: 'Weightlifting',                category: 'equestrian_strength',emoji: '🏋️' },
  { id: 'powerlifting',     name: 'Powerlifting',                 category: 'equestrian_strength',emoji: '🏋️' },
  { id: 'bodybuilding',     name: 'Bodybuilding',                 category: 'equestrian_strength',emoji: '💪' },
  { id: 'crossfit',         name: 'CrossFit',                     category: 'equestrian_strength',emoji: '🏋️' },

  // ── Esports ──────────────────────────────────────────────────────────────
  { id: 'lol',              name: 'League of Legends',            category: 'esports',           emoji: '🎮' },
  { id: 'cs2',              name: 'Counter-Strike (CS2)',         category: 'esports',           emoji: '🎮' },
  { id: 'dota2',            name: 'Dota 2',                       category: 'esports',           emoji: '🎮' },
  { id: 'valorant',         name: 'Valorant',                     category: 'esports',           emoji: '🎮' },
  { id: 'cod',              name: 'Call of Duty',                 category: 'esports',           emoji: '🎮' },
  { id: 'rocket_league',    name: 'Rocket League',                category: 'esports',           emoji: '🎮' },
  { id: 'starcraft2',       name: 'StarCraft II',                 category: 'esports',           emoji: '🎮' },
  { id: 'overwatch',        name: 'Overwatch',                    category: 'esports',           emoji: '🎮' },
  { id: 'ea_fc',            name: 'FIFA / EA FC',                 category: 'esports',           emoji: '🎮' },

  // ── Alternative & Action Sports ──────────────────────────────────────────
  { id: 'skateboarding',    name: 'Skateboarding',                category: 'action',            emoji: '🛹' },
  { id: 'surfing',          name: 'Surfing',                      category: 'action',            emoji: '🏄' },
  { id: 'snowboarding',     name: 'Snowboarding',                 category: 'action',            emoji: '🏂' },
  { id: 'bmx',              name: 'BMX',                          category: 'action',            emoji: '🚲' },
  { id: 'motocross',        name: 'Motocross',                    category: 'action',            emoji: '🏍️' },
  { id: 'supercross',       name: 'Supercross',                   category: 'action',            emoji: '🏍️' },
  { id: 'x_games',          name: 'X-Games Events',              category: 'action',            emoji: '🏅' },

  // ── Recreational & Lifestyle Sports ──────────────────────────────────────
  { id: 'chess',            name: 'Chess',                        category: 'recreational',      emoji: '♟️' },
  { id: 'poker',            name: 'Poker',                        category: 'recreational',      emoji: '🃏' },
  { id: 'bridge',           name: 'Bridge',                       category: 'recreational',      emoji: '🃏' },
  { id: 'fishing',          name: 'Fishing',                      category: 'recreational',      emoji: '🎣' },
  { id: 'pigeon_racing',    name: 'Pigeon Racing',                category: 'recreational',      emoji: '🕊️' },
  { id: 'cheerleading',     name: 'Cheerleading',                 category: 'recreational',      emoji: '📣' },
  { id: 'log_rolling',      name: 'Log Rolling',                  category: 'recreational',      emoji: '🪵' },

  // ── Indoor & Country Sports ───────────────────────────────────────────────
  { id: 'camogie',          name: 'Gaelic Camogie',               category: 'indoor_country',    emoji: '🟢' },
  { id: 'ladies_football',  name: "Gaelic Ladies' Football",      category: 'indoor_country',    emoji: '🟢' },
  { id: 'basque_pelota',    name: 'Basque Pelota',                category: 'indoor_country',    emoji: '🎾' },
  { id: 'gaelic_rounders',  name: 'Gaelic Rounders',              category: 'indoor_country',    emoji: '⚾' },
  { id: 'padel',            name: 'Padel',                        category: 'indoor_country',    emoji: '🎾' },
  { id: 'pickleball',       name: 'Pickleball',                   category: 'indoor_country',    emoji: '🏓' },
]

/** Human-readable labels for each category */
export const SPORT_CATEGORIES: Record<SportCategory, string> = {
  major_team:           'Major Global & Team Sports',
  racing_combat:        'Racing & Combat Sports',
  racket:               'Racket Sports',
  winter_water:         'Winter & Water Sports',
  cycling_athletics:    'Cycling & Athletics',
  niche_ball:           'Niche & Ball Sports',
  target_precision:     'Target & Precision Sports',
  combat_martial:       'Combat & Martial Arts',
  equestrian_strength:  'Equestrian & Strength Sports',
  esports:              'Esports',
  action:               'Alternative & Action Sports',
  recreational:         'Recreational & Lifestyle Sports',
  indoor_country:       'Indoor & Country Sports',
}

/** Look up a sport by its id */
export function getSport(id: string): Sport | undefined {
  return SPORTS.find(s => s.id === id)
}

/** All sports in a given category */
export function getSportsByCategory(category: SportCategory): Sport[] {
  return SPORTS.filter(s => s.category === category)
}
