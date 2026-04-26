// src/services/transferService.js

const API_KEY  = import.meta.env.VITE_FOOTBALL_API_KEY || "";

// Folosim proxy-ul Vite în loc de URL-ul direct
// /api/football/v4/... → https://api.football-data.org/v4/...
const BASE_URL = "/api/football/v4";

export const LEAGUE_CODES = {
  PL:  "Premier League",
  PD:  "La Liga",
  BL1: "Bundesliga",
  SA:  "Serie A",
  FL1: "Ligue 1",
};

// ── Cache în memorie (TTL 5 min) ──────────────────────────────────────────────
const _cache = new Map();

async function cachedGet(url, ttl = 300_000) {
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.ts < ttl) return hit.data;

  const res = await fetch(url, {
    headers: { "X-Auth-Token": API_KEY },
  });

  if (res.status === 429) throw new Error("Rate limit atins (10 req/min). Încearcă din nou.");
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);

  const data = await res.json();
  _cache.set(url, { data, ts: Date.now() });
  return data;
}

// ── Echipele dintr-o ligă (include squad pentru player database) ───────────────
export async function fetchTeams(leagueCode) {
  const data = await cachedGet(`${BASE_URL}/competitions/${leagueCode}/teams`);
  return data.teams.map((t) => ({
    id:      t.id,
    name:    t.shortName || t.name,
    full:    t.name,
    crest:   t.crest,
    league:  LEAGUE_CODES[leagueCode],
    players: (t.squad || []).map((p) => ({
      name:        p.name,
      position:    p.position ?? "Unknown",
      nationality: p.nationality ?? "",
      dateOfBirth: p.dateOfBirth ?? "",
    })),
  }));
}

// ── Toate echipele din toate ligile ───────────────────────────────────────────
export async function fetchAllTeams() {
  const results = await Promise.allSettled(
    Object.keys(LEAGUE_CODES).map((code) => fetchTeams(code))
  );
  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);
}