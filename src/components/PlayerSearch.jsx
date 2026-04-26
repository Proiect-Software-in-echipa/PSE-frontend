import { useState, useEffect, useRef, useCallback } from "react";
import "./PlayerSearch.css";

const POSITION_COLORS = {
  Goalkeeper: "#f59e0b",
  Defender:   "#3b82f6",
  Midfielder: "#8b5cf6",
  Attacker:   "#ef4444",
  Forward:    "#ef4444",
  Winger:     "#f97316",
};

const LEAGUE_COLORS = {
  "Premier League":  "#3d1eb4",
  "La Liga":         "#e8320e",
  "Bundesliga":      "#d20515",
  "Serie A":         "#1a4f9e",
  "Ligue 1":         "#ff4c00",
  "Saudi Pro League":"#1db954",
  "Primeira Liga":   "#006600",
  "Eredivisie":      "#ff6600",
};

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function posColor(pos) {
  return POSITION_COLORS[pos] ?? "#64748b";
}

function leagueColor(league) {
  return LEAGUE_COLORS[league] ?? "#555";
}

function Avatar({ name, photo, size = 64 }) {
  const [imgErr, setImgErr] = useState(false);
  const color = posColor("");
  if (photo && !imgErr) {
    return (
      <img
        src={photo}
        alt={name}
        className="ps-avatar-img"
        style={{ width: size, height: size }}
        onError={() => setImgErr(true)}
      />
    );
  }
  return (
    <div
      className="ps-avatar-initials"
      style={{ width: size, height: size, fontSize: size * 0.35, background: "#1e2a38", border: "2px solid #2d3f52" }}
    >
      {initials(name)}
    </div>
  );
}

// ── Player Detail Modal ───────────────────────────────────────────────────────
function PlayerDetailModal({ player, onClose }) {
  const [rumors, setRumors]               = useState(null);   // null = loading
  const [searchingRumors, setSearching]   = useState(false);
  const [searchMsg, setSearchMsg]         = useState("");

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Load stored rumors on open — auto-search if none found
  useEffect(() => {
    fetch(`/api/db/players/${player.id}/rumors`)
      .then((r) => r.json())
      .then((d) => {
        const stored = d.rumors ?? [];
        setRumors(stored);
        if (stored.length === 0) {
          // Nothing in DB yet — auto-trigger search
          handleSearchRumors();
        }
      })
      .catch(() => {
        setRumors([]);
        handleSearchRumors();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id]);

  async function handleSearchRumors() {
    setSearching(true);
    setSearchMsg("Searching feeds + asking Claude…");
    try {
      const res  = await fetch(`/api/db/players/${player.id}/rumors/search`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setRumors(data.rumors ?? []);
      setSearchMsg(data.inserted > 0
        ? `Found ${data.searched} article(s), saved ${data.inserted} new.`
        : data.searched > 0
        ? `Found ${data.searched} article(s) — all already saved.`
        : "No transfer articles found for this player."
      );
    } catch (err) {
      setSearchMsg(`Error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  }

  const pos  = player.position ?? "Unknown";
  const pCol = posColor(pos);
  const lCol = leagueColor(player.league_name);

  const dob = player.date_of_birth;
  const dobFormatted = dob
    ? new Date(dob).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const hasRumors = rumors && rumors.length > 0;

  return (
    <div className="ps-overlay" onClick={onClose}>
      <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ps-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div className="ps-modal-header">
          <Avatar name={player.name} photo={player.photo} size={90} />
          <div className="ps-modal-title">
            <h2 className="ps-modal-name">{player.name}</h2>
            <div className="ps-modal-badges">
              {pos !== "Unknown" && (
                <span className="ps-badge" style={{ background: `${pCol}22`, color: pCol, border: `1px solid ${pCol}55` }}>
                  {pos}
                </span>
              )}
              {player.jersey_number && (
                <span className="ps-badge ps-badge-number">#{player.jersey_number}</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="ps-stats-grid">
          <div className="ps-stat">
            <div className="ps-stat-label">Club</div>
            <div className="ps-stat-value">{player.club_name ?? "—"}</div>
          </div>
          <div className="ps-stat">
            <div className="ps-stat-label">League</div>
            <div className="ps-stat-value" style={{ color: lCol }}>{player.league_name ?? "—"}</div>
          </div>
          <div className="ps-stat">
            <div className="ps-stat-label">Nationality</div>
            <div className="ps-stat-value">{player.nationality ?? "—"}</div>
          </div>
          <div className="ps-stat">
            <div className="ps-stat-label">Age</div>
            <div className="ps-stat-value">{player.age ?? "—"}</div>
          </div>
          {dobFormatted && (
            <div className="ps-stat">
              <div className="ps-stat-label">Date of Birth</div>
              <div className="ps-stat-value">{dobFormatted}</div>
            </div>
          )}
          {player.height && (
            <div className="ps-stat">
              <div className="ps-stat-label">Height</div>
              <div className="ps-stat-value">{player.height}</div>
            </div>
          )}
          {player.weight && (
            <div className="ps-stat">
              <div className="ps-stat-label">Weight</div>
              <div className="ps-stat-value">{player.weight}</div>
            </div>
          )}
        </div>

        {/* Rumors section */}
        <div className="ps-rumors-section">
          <div className="ps-rumors-header">
            <span className="ps-rumors-title">TRANSFER RUMORS</span>
            {rumors === null ? (
              <span className="ps-rumors-status ps-rumors-loading">loading…</span>
            ) : hasRumors ? (
              <span className="ps-rumors-status ps-rumors-yes">{rumors.length} article{rumors.length !== 1 ? "s" : ""}</span>
            ) : (
              <span className="ps-rumors-status ps-rumors-none">no data</span>
            )}
            <button
              className="ps-rumors-search-btn"
              onClick={handleSearchRumors}
              disabled={searchingRumors}
            >
              {searchingRumors ? "Searching…" : "Search now"}
            </button>
          </div>

          {searchMsg && <div className="ps-rumors-msg">{searchMsg}</div>}

          {hasRumors && (
            <div className="ps-rumor-list">
              {rumors.map((r) => (
                <div key={r.id} className="ps-rumor-card">
                  <div className="ps-rumor-meta">
                    <span className="ps-rumor-handle">{r.source_handle}</span>
                    {r.window && <span className="ps-rumor-window">{r.window.replace("_", " ")}</span>}
                    {r.confidence != null && (
                      <span className="ps-rumor-confidence" style={{
                        color: r.confidence >= 0.7 ? "#10b981" : r.confidence >= 0.4 ? "#f59e0b" : "#ef4444"
                      }}>
                        {Math.round(r.confidence * 100)}%
                      </span>
                    )}
                    {r.confirmed ? <span className="ps-rumor-confirmed">CONFIRMED</span> : null}
                    <span className="ps-rumor-date">
                      {r.pub_date ? new Date(r.pub_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                    </span>
                  </div>
                  {r.title && <div className="ps-rumor-title-text">{r.title}</div>}
                  {r.summary && <div className="ps-rumor-summary">{r.summary}</div>}
                  {(r.from_club && r.from_club !== "Unknown") || (r.to_club && r.to_club !== "Unknown") ? (
                    <div className="ps-rumor-clubs">
                      {r.from_club && r.from_club !== "Unknown" && <span className="ps-rumor-from">{r.from_club}</span>}
                      {r.from_club && r.to_club && r.from_club !== "Unknown" && r.to_club !== "Unknown" && <span className="ps-rumor-arrow">→</span>}
                      {r.to_club && r.to_club !== "Unknown" && <span className="ps-rumor-to">{r.to_club}</span>}
                      {r.fee_million > 0 && <span className="ps-rumor-fee">€{r.fee_million}M</span>}
                    </div>
                  ) : null}
                  {r.link && (
                    <a className="ps-rumor-link" href={r.link} target="_blank" rel="noopener noreferrer">Read article</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Suggestion row ────────────────────────────────────────────────────────────
function SuggestionRow({ player, query, onClick }) {
  const pos  = player.position ?? "";
  const pCol = posColor(pos);

  // Highlight matched text
  function highlight(text) {
    if (!text || !query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="ps-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  // Determine what matched
  const matchedClub = player.club_name?.toLowerCase().includes(query.toLowerCase()) && !player.name.toLowerCase().includes(query.toLowerCase());
  const matchedNat  = player.nationality?.toLowerCase().includes(query.toLowerCase()) && !player.name.toLowerCase().includes(query.toLowerCase()) && !matchedClub;

  return (
    <div className="ps-suggestion" onClick={onClick}>
      <Avatar name={player.name} photo={player.photo} size={36} />
      <div className="ps-suggestion-info">
        <div className="ps-suggestion-name">{highlight(player.name)}</div>
        <div className="ps-suggestion-sub">
          {matchedClub
            ? <><span style={{ color: "#f59e0b" }}>{highlight(player.club_name)}</span> · {player.league_name}</>
            : matchedNat
            ? <><span style={{ color: "#60a5fa" }}>{highlight(player.nationality)}</span> · {player.club_name}</>
            : <>{player.club_name} · {player.league_name}</>
          }
        </div>
      </div>
      {pos && (
        <span className="ps-suggestion-pos" style={{ color: pCol, borderColor: `${pCol}55`, background: `${pCol}18` }}>
          {pos}
        </span>
      )}
    </div>
  );
}

// ── Main PlayerSearch ─────────────────────────────────────────────────────────
export default function PlayerSearch() {
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);
  const [selected, setSelected]     = useState(null);
  const [backendOk, setBackendOk]   = useState(null); // null=unknown, true, false
  const inputRef                    = useRef(null);
  const wrapRef                     = useRef(null);
  const debounceRef                 = useRef(null);

  // Check backend availability once
  useEffect(() => {
    fetch("/api/db/sync/status")
      .then((r) => r.ok ? setBackendOk(true) : setBackendOk(false))
      .catch(() => setBackendOk(false));
  }, []);

  // Debounced search — runs 3 parallel queries (name, club, nationality) and groups them
  const search = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const enc = encodeURIComponent(q);

        // 3 targeted queries in parallel
        const [byName, byClub, byNat] = await Promise.all([
          fetch(`/api/db/players?search=${enc}&limit=6`).then((r) => r.json()),
          fetch(`/api/db/players?club_search=${enc}&limit=8`).then((r) => r.json()),
          fetch(`/api/db/players?nationality=${enc}&limit=8`).then((r) => r.json()),
        ]);

        // Deduplicate across groups (by player id), keep group label
        const seenIds = new Set();
        const grouped = [];

        const addGroup = (label, players) => {
          const fresh = (players ?? []).filter((p) => !seenIds.has(p.id));
          fresh.forEach((p) => seenIds.add(p.id));
          if (fresh.length) grouped.push({ label, players: fresh });
        };

        addGroup("PLAYERS", byName.players);
        addGroup("FROM CLUB", byClub.players);
        addGroup("NATIONALITY", byNat.players);

        setResults(grouped);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  }, []);

  const totalResults = results.reduce((s, g) => s + g.players.length, 0);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    search(q);
  }

  function handleSelect(player) {
    setSelected(player);
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (backendOk === false) return null; // backend offline — hide component silently

  return (
    <>
      <div className="ps-wrap" ref={wrapRef}>
        <div className="ps-input-row">
          <span className="ps-icon">⚽</span>
          <input
            ref={inputRef}
            className="ps-input"
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => { if (results.length) setOpen(true); }}
            placeholder="Search player, club or nationality…"
            autoComplete="off"
          />
          {loading && <span className="ps-spinner"/>}
          {query && !loading && (
            <button className="ps-clear" onClick={() => { setQuery(""); setResults([]); setOpen(false); inputRef.current?.focus(); }}>✕</button>
          )}
        </div>

        {open && results.length > 0 && (
          <div className="ps-dropdown">
            {results.map((group) => (
              <div key={group.label}>
                <div className="ps-group-header">{group.label}</div>
                {group.players.map((p) => (
                  <SuggestionRow key={p.id} player={p} query={query} onClick={() => handleSelect(p)} />
                ))}
              </div>
            ))}
          </div>
        )}

        {open && query && !loading && results.length === 0 && (
          <div className="ps-dropdown">
            <div className="ps-no-results">No results for "{query}"</div>
          </div>
        )}
      </div>

      {selected && (
        <PlayerDetailModal player={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
