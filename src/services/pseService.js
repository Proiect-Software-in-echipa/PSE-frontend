// src/services/pseService.js
// PSE Backend API (FastAPI, localhost:8000) — proxied via /api/pse

const BASE = "/api/pse";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`PSE API ${res.status}: ${path}`);
  return res.json();
}

async function post(path) {
  const res = await fetch(`${BASE}${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`PSE API ${res.status}: ${path}`);
  return res.json();
}

export async function pseHealth() {
  return get("/health");
}

export async function pseTransfersAll() {
  return get("/transfers/all");
}

export async function pseTopTransfers(limit = 10) {
  return get(`/transfers/top?limit=${limit}`);
}

export async function pseTrendingTransfers(limit = 10) {
  return get(`/transfers/trending?limit=${limit}`);
}

export async function pseTransfers(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== "") q.set(k, v); });
  return get(`/transfers?${q.toString()}`);
}

export async function pseTransferDetail(id) {
  return get(`/transfers/${id}`);
}

export async function pseProbability(id) {
  return get(`/transfers/${id}/probability`);
}

export async function pseRefresh() {
  return post("/transfers/refresh");
}

export async function psePlayers(search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return get(`/players${q}`);
}

export async function pseTeams(search = "") {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return get(`/teams${q}`);
}

// Map PSE Transfer → UI item format
export function pseToUIItem(t, idGen) {
  const fee = parseFeeAmount(t.fee_amount);
  return {
    id:                idGen(),
    player:            t.player ?? "Unknown",
    from_club:         t.from_team ?? "Unknown",
    to_club:           t.to_team ?? "Unknown",
    league:            "Unknown",
    type:              "permanent",
    fee_million:       fee,
    confirmed:         t.status === "Confirmed",
    source:            t.status === "Confirmed" ? "Official" : "Journalist",
    handle:            t.sources ?? "",
    credibility:       t.probability ?? 0,
    credLabel:         probLabel(t.probability),
    credColor:         probColor(t.probability),
    confirmedByOthers: t.source_count ?? 1,
    contradictedBy:    0,
    text:              t.raw_title ?? `${t.player} → ${t.to_team}`,
    date:              t.transfer_timestamp ?? t.created_at ?? new Date().toISOString(),
    dateLabel:         formatDatePSE(t.transfer_timestamp ?? t.created_at),
    fromRSS:           false,
    fromDb:            false,
    fromPSE:           true,
    pse_id:            t.id,
    rumor_strength:    t.rumor_strength,
    rumor_share:       t.rumor_share,
    confidence_level:  t.confidence_level,
    source_articles:   t.url ? [{ title: t.raw_title ?? t.player, link: t.url, handle: t.sources }] : [],
    window:            "unknown",
    dead:              false,
  };
}

function parseFeeAmount(str) {
  if (!str) return 0;
  const n = parseFloat(String(str).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatDatePSE(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 3_600_000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function probLabel(p) {
  if (!p) return "Improbabil";
  if (p >= 0.85) return "Foarte probabil";
  if (p >= 0.65) return "Probabil";
  if (p >= 0.45) return "Posibil";
  if (p >= 0.25) return "Incert";
  return "Improbabil";
}

function probColor(p) {
  if (!p) return "#4a5f75";
  if (p >= 0.85) return "#39ff7a";
  if (p >= 0.65) return "#00e5ff";
  if (p >= 0.45) return "#f59e0b";
  if (p >= 0.25) return "#ff7c39";
  return "#ef4444";
}
