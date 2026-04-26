// src/services/scoringEngine.js
// ─────────────────────────────────────────────────────────────────────────────

// Jurnaliști de încredere cu scoruri calibrate manual
const TRUSTED_SOURCES = {
  "@FabrizioRomano":    { base: 0.97, leagues: null },       // null = toate ligile
  "@David_Ornstein":    { base: 0.94, leagues: ["Premier League"] },
  "@DiMarzio":          { base: 0.92, leagues: ["Serie A"] },
  "@MatteMoretto":      { base: 0.90, leagues: ["La Liga", "Serie A"] },
  "@SkySportsNews":     { base: 0.86, leagues: ["Premier League"] },
  "@RomeoFavia":        { base: 0.85, leagues: ["Bundesliga"] },
  "@LEquipe":           { base: 0.84, leagues: ["Ligue 1"] },
  "@sport1":            { base: 0.82, leagues: ["Bundesliga"] },
  "@TransferNewsLive":  { base: 0.55, leagues: null },
  "@FootballTransfers": { base: 0.50, leagues: null },
  "r/soccer":           { base: 0.38, leagues: null },
  "r/footballtransfers":{ base: 0.42, leagues: null },
};

const SOURCE_TYPE_BASE = {
  Official:    1.00,
  Journalist:  0.72,
  "Twitter/X": 0.42,
  Reddit:      0.35,
};

/**
 * Calculează credibilitatea unui zvon/transfer.
 *
 * @param {object} p
 * @param {string}  p.handle           - ex: "@FabrizioRomano"
 * @param {string}  p.sourceType       - "Official" | "Journalist" | "Twitter/X" | "Reddit"
 * @param {string}  p.league           - liga echipei destinație
 * @param {number}  p.confirmedByOthers - câte alte surse confirmă (0-5)
 * @param {number}  p.contradictedBy   - câte surse neagă (0-3)
 * @param {number}  p.hoursAgo         - vârsta știrii în ore
 * @param {number}  p.feeReported      - fee în milioane (0 dacă necunoscut)
 * @param {number}  p.marketValue      - valoarea de piață estimată
 * @param {boolean} p.isOfficial       - anunț oficial de club
 * @returns {number} scor între 0.05 și 1.00
 */
export function calcCredibility({
  handle,
  sourceType,
  league,
  confirmedByOthers = 0,
  contradictedBy    = 0,
  hoursAgo          = 0,
  feeReported       = 0,
  marketValue       = 0,
  isOfficial        = false,
}) {
  // Anunțul oficial = scor maxim întotdeauna
  if (isOfficial) return 1.0;

  // 1. Scor de bază după tipul sursei
  let score = SOURCE_TYPE_BASE[sourceType] ?? 0.30;

  // 2. Ajustare după jurnalistul specific
  const src = TRUSTED_SOURCES[handle];
  if (src) {
    // Blending 30/70 între tipul sursei și reputația specifică
    score = score * 0.30 + src.base * 0.70;

    // Bonus dacă jurnalistul e specialist pe liga respectivă
    if (src.leagues === null || src.leagues.includes(league)) {
      score += 0.04;
    }
  }

  // 3. Bonus confirmări (randament descrescător)
  score += Math.min(confirmedByOthers * 0.06, 0.18);

  // 4. Penalizare contradicții
  score -= Math.min(contradictedBy * 0.10, 0.25);

  // 5. Time decay (știrile vechi de 48h+ pierd relevanță)
  if (hoursAgo > 48) {
    score -= Math.min((hoursAgo - 48) / 240, 0.12);
  }

  // 6. Consistența fee-ului față de valoarea de piață
  if (feeReported > 0 && marketValue > 0) {
    const ratio = feeReported / marketValue;
    if (ratio >= 0.5 && ratio <= 2.5) score += 0.03;  // fee rezonabil
    else if (ratio > 6 || ratio < 0.08) score -= 0.07; // fee absurd
  }

  return Math.min(Math.max(+score.toFixed(3), 0.05), 1.0);
}

/**
 * Returnează eticheta textuală pentru un scor de credibilitate.
 */
export function credLabel(score) {
  if (score >= 0.95) return "CONFIRMED";
  if (score >= 0.80) return "VERY LIKELY";
  if (score >= 0.65) return "LIKELY";
  if (score >= 0.50) return "POSSIBLE";
  if (score >= 0.35) return "RUMOR";
  return "SPECULATION";
}

/**
 * Culoarea asociată scorului de credibilitate.
 */
export function credColor(score) {
  if (score >= 0.95) return "#39ff7a";
  if (score >= 0.80) return "#00e5ff";
  if (score >= 0.65) return "#ffc93c";
  if (score >= 0.50) return "#ff9f00";
  return "#ff3d5a";
}