// src/services/rssService.js
// RSS feeds sunt proxiate prin Vite dev server (server-to-server, fără CORS)

// ── RSS Feeds ─────────────────────────────────────────────────────────────────
// Removed: TalkSport (HTML block), AS English (HTML block), The Sun (HTML block),
// 90min was removed before but is back (XML OK), Goal.com (404).
export const RSS_FEEDS = [
  { name: "Sky Sports Football",    url: "/api/rss/skysports",          handle: "@SkySportsNews"    },
  { name: "BBC Sport Football",     url: "/api/rss/bbc",                handle: "@BBCSport"         },
  { name: "The Guardian",           url: "/api/rss/guardian",           handle: "@GuardianFootball" },
  { name: "ESPN Soccer",            url: "/api/rss/espn",               handle: "@ESPNSoccernet"    },
  { name: "Daily Mail Football",    url: "/api/rss/dailymail",          handle: "@MailSport"        },
  { name: "Football Insider",       url: "/api/rss/footballinsider",    handle: "@FootballInsider_" },
  { name: "GiveMeSport",            url: "/api/rss/givemesport",        handle: "@GiveMeSport"      },
  { name: "90min",                  url: "/api/rss/90min",              handle: "@90min"            },
  { name: "Transfermarkt",          url: "/api/rss/transfermarkt",      handle: "@Transfermarkt"    },
];

// ── Parse RSS or Atom XML ─────────────────────────────────────────────────────
export function parseRSS(xmlText) {
  if (xmlText.trimStart().startsWith("<html") || xmlText.trimStart().startsWith("<!DOCTYPE")) {
    throw new Error("Received HTML instead of XML — site may be blocking the request");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML invalid");

  // Support both RSS <item> and Atom <entry>
  const items = Array.from(doc.querySelectorAll("item")).length > 0
    ? doc.querySelectorAll("item")
    : doc.querySelectorAll("entry");

  return Array.from(items).slice(0, 12).map((item) => ({
    title:       item.querySelector("title")?.textContent?.trim() ?? "",
    description: (item.querySelector("description") ?? item.querySelector("summary") ?? item.querySelector("content"))
                   ?.textContent?.replace(/<[^>]+>/g, "").trim() ?? "",
    pubDate:     (item.querySelector("pubDate") ?? item.querySelector("published") ?? item.querySelector("updated"))
                   ?.textContent ?? new Date().toISOString(),
    // Atom uses <link href="...">, RSS 2.0 uses <link> text content
    link:        (item.querySelector("link[href]")?.getAttribute("href") ??
                  item.querySelector("link")?.textContent?.trim() ?? ""),
  }));
}

// ── Fetch un feed prin Vite proxy (server-to-server) ─────────────────────────
export async function fetchRSSFeed(feed) {
  const res = await fetch(feed.url);
  if (!res.ok) throw new Error(`Fetch error ${res.status} pentru ${feed.name}`);

  const xmlText = await res.text();
  const articles = parseRSS(xmlText);
  return articles.map((a) => ({ ...a, feedName: feed.name, handle: feed.handle }));
}

// ── Extrage transferuri cu Claude ─────────────────────────────────────────────
export async function extractTransfersWithClaude(articles, knownClubs = [], playerDb = []) {
  const clubList = knownClubs.length > 0
    ? knownClubs.slice(0, 80).map((c) => c.name).join(", ")
    : "Real Madrid, Barcelona, Man City, Arsenal, Liverpool, PSG, Bayern Munich, Juventus, Chelsea, Man United";

  // Sample up to 300 known players to help Claude identify names
  const playerList = playerDb.length > 0
    ? playerDb.slice(0, 300).map((p) => `${p.name} (${p.club})`).join(", ")
    : "";

  const articlesText = articles
    .map((a, i) => `[${i + 1}] ${a.handle} | ${a.pubDate}\nTITLE: ${a.title}\nDESC: ${a.description}`)
    .join("\n\n");

  const prompt = `You are a football transfer analyst. Today is March 2026. We are BETWEEN transfer windows. The NEXT transfer window is Summer 2026 (opens June 2026).

Extract ALL transfer-related information from these articles, prioritising:
1. Summer 2026 transfer rumors, links, and targets
2. Pre-contract signings (players whose contracts expire June 2026)
3. Players being linked for next season
4. Recent confirmed deals (January 2026 window)
5. Contract extensions, renewals, and release clause activations

Known clubs: ${clubList}
${playerList ? `\nKnown players currently in top leagues (use to identify names):\n${playerList}` : ""}

Articles:
${articlesText}

Return ONLY a JSON array — no markdown, no explanation, no extra text.
Skip only pure match reports with zero transfer content.

Rules:
- from_club: the club the player is LEAVING (their current club). to_club: the club the player is JOINING (their destination).
- fee_million: the transfer fee as a number in EURO millions only. Convert: GBP × 1.17, USD ÷ 1.08. Use 0 if unknown or free.
- confirmed: true only if officially announced or medically confirmed. false for rumors/links/speculation/summer targets.
- source_handle: use the article's source handle from the [N] header line.
- window: "summer_2026" for upcoming summer targets/speculation, "winter_2026" for January window deals, "unknown" if unclear.
- dead: true if the article explicitly says the deal fell through, interest has cooled/ended, the player rejected the move, or talks collapsed. false otherwise.

Each object:
{
  "player": "Full Name",
  "from_club": "Current Club or Unknown",
  "to_club": "Destination Club or Unknown",
  "fee_million": 0,
  "type": "permanent" | "loan" | "free transfer" | "contract extension",
  "confirmed": false,
  "dead": false,
  "confidence": 0.1-1.0,
  "source_handle": "@handle",
  "summary": "one sentence max",
  "pub_date": "ISO date string",
  "window": "summer_2026"
}

If truly nothing transfer-related found: []`;

  const response = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API ${response.status}: ${err?.error?.message ?? "unknown"}`);
  }

  const data = await response.json();
  const text = data.content.map((c) => c.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) ?? [];
}

// ── Persistent history (localStorage, 90 days, max 600 entries) ──────────────
const HISTORY_KEY = "ftt_history_v1";
const HISTORY_TTL = 90 * 24 * 60 * 60 * 1000;
const HISTORY_MAX = 600;

// Key = player + destination so the same player linked to different clubs = separate entries
function historyKey(t) {
  return `${(t.player ?? "").toLowerCase().trim()}|${(t.to_club ?? "").toLowerCase().trim()}`;
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const cutoff = Date.now() - HISTORY_TTL;
    return JSON.parse(raw).filter(
      (t) => new Date(t.pub_date || 0).getTime() > cutoff
    );
  } catch { return []; }
}

function saveHistory(transfers) {
  try {
    const sorted = [...transfers]
      .sort((a, b) => new Date(b.pub_date || 0) - new Date(a.pub_date || 0))
      .slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sorted));
  } catch { /* localStorage full — skip */ }
}

function mergeWithHistory(history, fresh) {
  const map = new Map();
  // History goes in first (older, lower priority)
  for (const t of history) {
    const k = historyKey(t);
    if (k !== "|") map.set(k, t);
  }
  // Fresh data overrides history but merges source_articles
  for (const t of fresh) {
    const k = historyKey(t);
    if (k === "|") continue;
    const existing = map.get(k);
    if (existing) {
      // Merge source_articles, deduplicated by link URL
      const allArticles = [...(existing.source_articles ?? []), ...(t.source_articles ?? [])];
      const seenLinks = new Set();
      const mergedArticles = allArticles.filter((a) => {
        if (!a.link) return true;
        if (seenLinks.has(a.link)) return false;
        seenLinks.add(a.link);
        return true;
      });
      map.set(k, { ...t, source_articles: mergedArticles });
    } else {
      map.set(k, t);
    }
  }
  const merged = Array.from(map.values());
  saveHistory(merged);
  return merged;
}

// ── Deduplicare transferuri: grupare după jucător, contorizare surse ──────────
function deduplicateTransfers(transfers) {
  const map = new Map();
  for (const t of transfers) {
    const key = (t.player ?? "").toLowerCase().trim();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { ...t, sources: [t.source_handle].filter(Boolean), source_articles: t.source_articles ?? [] });
    } else {
      const ex = map.get(key);
      if (t.source_handle && !ex.sources.includes(t.source_handle)) {
        ex.sources.push(t.source_handle);
      }
      if (t.source_articles?.length) ex.source_articles.push(...t.source_articles);
      // Keep highest-confidence version of the transfer data
      if ((t.confidence ?? 0) > (ex.confidence ?? 0)) {
        const { sources, source_articles } = ex;
        Object.assign(ex, t, { sources, source_articles });
      }
    }
  }
  return Array.from(map.values()).map((t) => ({
    ...t,
    source_count: t.sources.length,
    // Require ≥2 unique sources before marking as confirmed
    confirmed: t.confirmed && t.sources.length >= 2,
  }));
}

// ── Pipeline complet ──────────────────────────────────────────────────────────
export async function fetchAndExtractTransfers(knownClubs = [], playerDb = []) {
  const results = { transfers: [], errors: [], feedsProcessed: 0, articlesProcessed: 0, historyCount: 0 };

  // Load persisted history upfront — always returned even if fetch fails
  const history = loadHistory();
  results.historyCount = history.length;

  // 1. Fetch toate feed-urile în paralel
  const feedResults = await Promise.allSettled(RSS_FEEDS.map(fetchRSSFeed));

  const allArticles = [];
  feedResults.forEach((r) => {
    if (r.status === "fulfilled") {
      allArticles.push(...r.value);
      results.feedsProcessed++;
    } else {
      results.errors.push(r.reason?.message ?? "RSS fetch failed");
    }
  });

  if (allArticles.length === 0) {
    results.errors.push("Niciun articol disponibil din feed-uri.");
    results.transfers = history; // show history even when feeds are all down
    return results;
  }

  // 2. Filtrează articolele relevante
  const KEYWORDS = [
    "transfer","sign","signing","joins","move","deal","fee","loan","bid","contract",
    "agree","complet","medical","here we go","linked","target","interest","want",
    "summer","window","exit","release","reject","offer","approach","swoop",
    "next season","2026","pre-contract","expire","free agent","release clause",
    "january","done deal","permanent","extension","renew","sold","swap",
  ];

  const relevant = allArticles.filter(({ title, description }) =>
    KEYWORDS.some((kw) => `${title} ${description}`.toLowerCase().includes(kw))
  );

  results.articlesProcessed = relevant.length;

  if (relevant.length === 0) {
    results.errors.push("Niciun articol despre transferuri în feed-uri.");
    results.transfers = history;
    return results;
  }

  // 3. Trimite la Claude în batch-uri de 8
  for (let i = 0; i < Math.min(relevant.length, 24); i += 8) {
    const batch = relevant.slice(i, i + 8);
    try {
      const extracted = await extractTransfersWithClaude(batch, knownClubs, playerDb);
      // Attach original article data (link, title) matched by source handle
      const withArticles = extracted.map((t) => {
        const sourceArticles = batch
          .filter((a) => a.handle === t.source_handle)
          .map((a) => ({ title: a.title, link: a.link, handle: a.handle, date: a.pubDate }));
        return { ...t, source_articles: sourceArticles };
      });
      results.transfers.push(...withArticles);
    } catch (err) {
      results.errors.push(`Batch ${Math.floor(i / 8) + 1}: ${err.message}`);
    }
  }

  // 4. Deduplicare: grupare după jucător+destinație, minim 2 surse pentru confirmed
  const freshDeduped = deduplicateTransfers(results.transfers);

  // 5. Merge fresh with persisted history and save back (90 days rolling window)
  results.transfers = mergeWithHistory(history, freshDeduped);

  return results;
}