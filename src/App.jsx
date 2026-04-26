import { useState, useEffect, useRef } from "react";
import "./App.css";
import { pseHealth, pseTransfersAll, pseRefresh, pseToUIItem } from "./services/pseService";

let _id = 1;

const fmtNum = (n) => Number(n ?? 0).toLocaleString("de-DE");

// ─── UI Components ────────────────────────────────────────────────────────────

function CredBar({ value, color }) {
  return (
    <div className="cred-bar-wrap">
      <div className="cred-bar-track"
        style={{ background: `linear-gradient(90deg,${color} ${value * 100}%,#1e2a38 ${value * 100}%)` }} />
      <span className="cred-bar-label" style={{ color }}>{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function CredBadge({ label, color }) {
  return <span className="cred-badge" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>{label}</span>;
}

function StatPill({ label, value, color, sub, wide }) {
  return (
    <div className="stat-pill" style={{ border: `1px solid ${color}33`, ...(wide ? { flex: 1.4, minWidth: 180 } : null) }}>
      <div className="stat-pill-label">{label}</div>
      <div className="stat-pill-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-pill-sub">{sub}</div>}
    </div>
  );
}

function Ticker({ items }) {
  if (!items.length) return null;
  const text = items.map((i) => `${i.confirmed ? "✅" : "🔴"} ${i.player} → ${i.to_club}  •  `).join("");
  return <div className="ticker-wrap"><div className="ticker-inner"><span>{text}{text}</span></div></div>;
}

function AlertsBanner({ alerts }) {
  if (!alerts.length) return null;
  return (
    <div className="alerts-banner">
      <span className="alerts-icon">🔔</span>
      <div>
        <div className="alerts-title">Favorite Alerts ({alerts.length})</div>
        <div className="alerts-text">
          {alerts.slice(0, 3).map((a) => `${a.player} → ${a.to_club}`).join("  •  ")}
          {alerts.length > 3 && `  •  +${alerts.length - 3} more`}
        </div>
      </div>
    </div>
  );
}

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  let start = 0;
  const slices = data.map((d) => {
    const pct = d.value / total;
    const a1 = start * 2 * Math.PI - Math.PI / 2, a2 = (start + pct) * 2 * Math.PI - Math.PI / 2;
    const r = 52, cx = 60, cy = 60;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`;
    start += pct;
    return { ...d, path };
  });
  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.9} />)}
      <circle cx={60} cy={60} r={30} fill="var(--surface)" />
      <text x={60} y={65} textAnchor="middle" fill="var(--text)"
        style={{ fontFamily: "var(--font-head)", fontSize: 18 }}>{total}</text>
    </svg>
  );
}

// ─── Transfer Card ────────────────────────────────────────────────────────────
function TransferCard({ item, animate, onClick }) {
  return (
    <div className={`transfer-card ${animate ? "animate" : ""}`}
      style={{ borderLeft: `3px solid ${item.confirmed ? "var(--accent3)" : item.credColor}`, cursor: "pointer" }}
      onClick={onClick}>
      <div className="card-inner">
        <div className="card-left">
          <div className="card-player-row">
            <span className="card-player-name" style={{ color: item.confirmed ? "var(--accent3)" : "var(--text)" }}>
              {item.player}
            </span>
            <span className={`card-type-badge ${item.confirmed ? "confirmed" : "rumor"}`}>
              {item.confirmed ? "CONFIRMED" : "RUMOR"}
            </span>
            <CredBadge label={item.credLabel} color={item.credColor} />
          </div>
          <div className="card-clubs">
            <span className="card-from">{item.from_club}</span>
            <span className="card-arrow">→</span>
            <span className="card-to">{item.to_club}</span>
          </div>
          {item.confirmedByOthers > 0 && (
            <div className="card-confirmations">
              {Array.from({ length: Math.min(item.confirmedByOthers, 5) }).map((_, i) => (
                <span key={i} className="confirm-dot">✓</span>
              ))}
              <span className="confirm-text">{item.confirmedByOthers} {item.confirmedByOthers === 1 ? "sursă" : "surse"}</span>
            </div>
          )}
          {item.rumor_strength != null && (
            <div style={{ fontSize: 11, color: "#4a5f75", marginTop: 2, fontFamily: "var(--font-mono)" }}>
              strength: <span style={{ color: item.credColor }}>{item.rumor_strength.toFixed(1)}</span> / 10
            </div>
          )}
          <p className="card-text">{item.text}</p>
        </div>
        <div className="card-right">
          {item.fee_million > 0 && <div className="card-fee">€{fmtNum(item.fee_million)}</div>}
          {!item.confirmed && <div className="card-cred"><CredBar value={item.credibility} color={item.credColor} /></div>}
          <div className="card-date">{item.dateLabel}</div>
          <div className="card-handle" style={{ color: item.credColor, fontSize: 10 }}>{item.handle}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Player Modal ─────────────────────────────────────────────────────────────
function PlayerModal({ item, allItems, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const playerItems = allItems.filter((i) => i.player.toLowerCase() === item.player.toLowerCase());

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pm-close" onClick={onClose}>✕</button>

        <div className="pm-header">
          <div className="pm-name">{item.player}</div>
          <div className="pm-clubs">
            <span className="pm-from">{item.from_club}</span>
            <span className="pm-arrow">→</span>
            <span className="pm-to">{item.to_club}</span>
          </div>
          {item.fee_million > 0 && <div className="pm-fee">€{fmtNum(item.fee_million)}</div>}
          {item.rumor_strength != null && (
            <div style={{ fontSize: 12, color: "#4a5f75", marginTop: 6, fontFamily: "var(--font-mono)" }}>
              Rumor strength: <span style={{ color: item.credColor, fontWeight: 700 }}>
                {item.rumor_strength.toFixed(1)} / 10
              </span>
              {"  ·  "}
              Probability: <span style={{ color: item.credColor, fontWeight: 700 }}>
                {(item.credibility * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        <div className="pm-section-title">ALL LINKS ({playerItems.length})</div>
        <div className="pm-articles">
          {playerItems.map((pi) => (
            <div key={pi.id} className="pm-article">
              <div className="pm-article-header">
                <span className={`card-type-badge ${pi.confirmed ? "confirmed" : "rumor"}`}>
                  {pi.confirmed ? "CONFIRMED" : "RUMOR"}
                </span>
                <CredBadge label={pi.credLabel} color={pi.credColor} />
                <span className="pm-article-date">{pi.dateLabel}</span>
              </div>
              <p className="pm-article-text">{pi.text}</p>
              {pi.handle && (
                <div style={{ fontSize: 11, color: "#4a5f75", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                  Sources: {pi.handle}
                </div>
              )}
              {(pi.source_articles ?? []).filter((a) => a.link).map((a, i) => (
                <a key={i} href={a.link} target="_blank" rel="noreferrer" className="pm-link pm-link-block">
                  ↗ {a.title || "Read article"}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [confirmed, setConfirmed]           = useState([]);
  const [rumors, setRumors]                 = useState([]);
  const [pseStatus, setPseStatus]           = useState("idle");
  const [health, setHealth]                 = useState(null);
  const [tab, setTab]                       = useState("transfers");
  const [clubFilter, setClubFilter]         = useState("");
  const [playerFilter, setPlayerFilter]     = useState("");
  const [favorites, setFavorites]           = useState({ players: [], clubs: [] });
  const [newFavPlayer, setNewFavPlayer]     = useState("");
  const [newFavClub, setNewFavClub]         = useState("");
  const [lastUpdate, setLastUpdate]         = useState(new Date());
  const [showFavPanel, setShowFavPanel]     = useState(false);
  const [animKey, setAnimKey]               = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [refreshing, setRefreshing]         = useState(false);
  const hasFetched                          = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadPSE();
  }, []);

  useEffect(() => {
    const t = setInterval(loadPSE, 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  async function loadPSE() {
    try {
      const h = await pseHealth();
      setHealth(h);
      setPseStatus("loading");

      const allRaw = await pseTransfersAll();
      const items = (allRaw ?? []).map((t) => pseToUIItem(t, () => _id++));
      setConfirmed(items.filter((i) => i.confirmed).sort((a, b) => new Date(b.date) - new Date(a.date)));
      setRumors(items.filter((i) => !i.confirmed).sort((a, b) => b.credibility - a.credibility));
      setLastUpdate(new Date());
      setAnimKey((k) => k + 1);
      setPseStatus("ok");
    } catch {
      setPseStatus("offline");
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await pseRefresh();
      await loadPSE();
    } catch (err) {
      alert(`❌ Refresh failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  }

  const allItems = [...confirmed, ...rumors];

  const filterFn = (item) => {
    if (clubFilter && !item.to_club.toLowerCase().includes(clubFilter.toLowerCase()) &&
        !item.from_club.toLowerCase().includes(clubFilter.toLowerCase())) return false;
    if (playerFilter && !item.player.toLowerCase().includes(playerFilter.toLowerCase())) return false;
    return true;
  };

  const filteredConfirmed = confirmed.filter(filterFn);
  const filteredRumors    = rumors.filter(filterFn);

  const alerts = allItems.filter((item) =>
    favorites.players.some((p) => item.player.toLowerCase().includes(p.toLowerCase())) ||
    favorites.clubs.some((c) =>
      item.to_club.toLowerCase().includes(c.toLowerCase()) ||
      item.from_club.toLowerCase().includes(c.toLowerCase()))
  ).slice(0, 8);

  const totalFee  = confirmed.filter((t) => t.fee_million > 0).reduce((s, t) => s + t.fee_million, 0).toFixed(0);
  const topRumor  = rumors[0];
  const hasFilters = clubFilter || playerFilter;

  const PROB_BUCKETS = [
    { label: "Foarte probabil (≥85%)",  min: 0.85, color: "#39ff7a" },
    { label: "Probabil (65–84%)",        min: 0.65, color: "#00e5ff" },
    { label: "Posibil (45–64%)",         min: 0.45, color: "#f59e0b" },
    { label: "Incert (25–44%)",          min: 0.25, color: "#ff7c39" },
    { label: "Improbabil (<25%)",        min: 0.00, color: "#ef4444" },
  ];

  return (
    <div className="app-wrapper">
      <div className="scan-line-overlay" />

      <header className="app-header">
        <div className="inner">
          <div className="header-top">
            <div>
              <h1 className="app-title">TRANSFER TRACKER</h1>
              <div className="app-subtitle">⚽ PSE INTELLIGENCE ENGINE</div>
            </div>
            <div className="header-controls">
              {/* PSE status */}
              <div className={`api-status-pill status-${pseStatus === "ok" ? "success" : pseStatus === "offline" ? "error" : pseStatus === "loading" ? "loading" : "idle"}`}>
                {pseStatus === "loading"  && <><span className="spinner" />PSE…</>}
                {pseStatus === "ok"       && <><span className="dot green" />{health?.transfers_loaded ?? allItems.length} TRANSFERS</>}
                {pseStatus === "offline"  && <><span className="dot red" />PSE OFFLINE</>}
                {pseStatus === "idle"     && <><span className="dot yellow" />PSE</>}
              </div>
              <div className="live-indicator">
                <div className="live-dot" /><span className="live-label">LIVE</span>
              </div>
              <span className="update-time">
                {lastUpdate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button className="btn btn-refresh" onClick={loadPSE}>↺ REFRESH</button>
              <button className="btn" style={{ color: "#a78bfa", borderColor: "#a78bfa55" }}
                onClick={handleRefresh}
                disabled={refreshing}
                title="Forțează re-fetch din S3 (cache bust)">
                {refreshing ? "⟳ SYNC…" : "⟳ S3 SYNC"}
              </button>
              <button className={`btn btn-fav ${showFavPanel ? "active" : ""}`}
                onClick={() => setShowFavPanel((p) => !p)}>⭐</button>
            </div>
          </div>

          {/* Status banners */}
          {pseStatus === "loading" && (
            <div className="api-info-banner">⟳ Loading transfers from PSE backend…</div>
          )}
          {pseStatus === "offline" && (
            <div className="api-error-banner">❌ PSE backend offline — start it on <code>localhost:8000</code></div>
          )}

          <div className="stats-row">
            <StatPill label="Confirmed"   value={fmtNum(confirmed.length)} color="var(--accent3)" sub="this window" />
            <StatPill label="Rumors"      value={fmtNum(rumors.length)}    color="var(--accent)"  sub="tracked" />
            <StatPill label="Total Fees"  value={`€${fmtNum(totalFee)}`}  color="var(--gold)"    sub="confirmed" wide />
            <StatPill label="Top Rumor"
              value={topRumor ? `${(topRumor.credibility * 100).toFixed(1)}%` : "—"}
              color={topRumor?.credColor ?? "var(--accent2)"} sub={topRumor?.player ?? ""} />
            <StatPill label="Loaded"
              value={fmtNum(health?.transfers_loaded ?? allItems.length)}
              color="#a78bfa" sub="in DB" />
          </div>
        </div>
      </header>

      <Ticker items={[...confirmed.slice(0, 6), ...rumors.slice(0, 6)]} />

      <div className="page-content">
        {showFavPanel && (
          <div className="fav-panel">
            <div className="fav-panel-title">⭐ FAVORITES &amp; ALERTS</div>
            <div className="fav-panel-body">
              <div className="fav-col">
                <div className="fav-col-label">TRACKED PLAYERS</div>
                <div className="fav-tags">
                  {favorites.players.map((p) => (
                    <span key={p} className="fav-tag-player"
                      onClick={() => setFavorites((f) => ({ ...f, players: f.players.filter((x) => x !== p) }))}>
                      {p} ✕
                    </span>
                  ))}
                </div>
                <div className="fav-add-row">
                  <input className="filter-input" style={{ flex: 1 }} value={newFavPlayer}
                    onChange={(e) => setNewFavPlayer(e.target.value)} placeholder="Add player…" />
                  <button className="btn-add-accent" onClick={() => {
                    if (newFavPlayer.trim()) { setFavorites((f) => ({ ...f, players: [...f.players, newFavPlayer.trim()] })); setNewFavPlayer(""); }
                  }}>ADD</button>
                </div>
              </div>
              <div className="fav-col">
                <div className="fav-col-label">TRACKED CLUBS</div>
                <div className="fav-tags">
                  {favorites.clubs.map((c) => (
                    <span key={c} className="fav-tag-club"
                      onClick={() => setFavorites((f) => ({ ...f, clubs: f.clubs.filter((x) => x !== c) }))}>
                      {c} ✕
                    </span>
                  ))}
                </div>
                <div className="fav-add-row">
                  <input className="filter-input" style={{ flex: 1 }} value={newFavClub}
                    onChange={(e) => setNewFavClub(e.target.value)} placeholder="Add club…" />
                  <button className="btn-add-green" onClick={() => {
                    if (newFavClub.trim()) { setFavorites((f) => ({ ...f, clubs: [...f.clubs, newFavClub.trim()] })); setNewFavClub(""); }
                  }}>ADD</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AlertsBanner alerts={alerts} />

        <div className="filters-bar">
          <span className="filters-label">Filters:</span>
          <input className="filter-input" placeholder="Search club…" value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value)} />
          <input className="filter-input" placeholder="Search player…" value={playerFilter}
            onChange={(e) => setPlayerFilter(e.target.value)} />
          {hasFilters && (
            <button className="btn-clear" onClick={() => { setClubFilter(""); setPlayerFilter(""); }}>
              ✕ CLEAR
            </button>
          )}
        </div>

        <div className="tabs">
          {["transfers", "rumors", "analytics"].map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "transfers" && "✅ "}
              {t === "rumors" && "🔴 "}
              {t === "analytics" && "📊 "}
              {t.toUpperCase()}
              {t !== "analytics" && (
                <span className="tab-count">{fmtNum(t === "transfers" ? filteredConfirmed.length : filteredRumors.length)}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "transfers" && (
          <div className="cards-list">
            {filteredConfirmed.length === 0
              ? <div className="empty-state">{pseStatus === "offline" ? "PSE backend offline." : "No confirmed transfers."}</div>
              : filteredConfirmed.map((item, i) => (
                <TransferCard key={`${item.id}-${animKey}`} item={item} animate={i < 6}
                  onClick={() => setSelectedPlayer(item)} />
              ))}
          </div>
        )}

        {tab === "rumors" && (
          <div>
            <div className="rumor-chart-box">
              <div className="section-title-accent">TOP RUMORS BY PROBABILITY</div>
              <div className="rumor-bars">
                {filteredRumors.slice(0, 10).map((r, i) => (
                  <div key={r.id} className="rumor-bar-row">
                    <span className="rumor-bar-rank">{i + 1}</span>
                    <div className="rumor-bar" style={{
                      width: `${Math.max(r.credibility * 100, 20)}%`,
                      background: `linear-gradient(90deg,${r.credColor}44,${r.credColor}22)`,
                      border: `1px solid ${r.credColor}44`,
                    }}>
                      <span className="rumor-bar-player">{r.player}</span>
                      <span className="rumor-bar-club">→ {r.to_club}</span>
                    </div>
                    <span className="rumor-bar-pct" style={{ color: r.credColor }}>{(r.credibility * 100).toFixed(1)}%</span>
                    <CredBadge label={r.credLabel} color={r.credColor} />
                  </div>
                ))}
              </div>
            </div>
            <div className="cards-list">
              {filteredRumors.length === 0
                ? <div className="empty-state">{pseStatus === "offline" ? "PSE backend offline." : "No rumors match filters."}</div>
                : filteredRumors.map((item, i) => (
                  <TransferCard key={`${item.id}-${animKey}`} item={item} animate={i < 6}
                    onClick={() => setSelectedPlayer(item)} />
                ))}
            </div>
          </div>
        )}

        {tab === "analytics" && (
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="section-title-accent">PROBABILITY DISTRIBUTION</div>
              {PROB_BUCKETS.map(({ label, min, color }, idx, arr) => {
                const max = arr[idx - 1]?.min ?? 1.01;
                const count = [...confirmed, ...rumors].filter((r) => r.credibility >= min && r.credibility < max).length;
                return (
                  <div key={label} className="src-bar-item">
                    <div className="src-bar-header">
                      <span style={{ fontSize: 11 }}>{label}</span>
                      <span className="src-bar-count" style={{ color }}>{fmtNum(count)}</span>
                    </div>
                    <div className="src-bar-track">
                      <div className="src-bar-fill" style={{
                        width: `${allItems.length ? ((count / allItems.length) * 100).toFixed(0) : 0}%`,
                        background: `linear-gradient(90deg,${color},${color}88)`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="analytics-card">
              <div className="section-title-accent">RUMOR STRENGTH DISTRIBUTION</div>
              {[
                { label: "High (8–10)",   min: 8,  color: "#39ff7a" },
                { label: "Medium (5–8)",  min: 5,  color: "#f59e0b" },
                { label: "Low (0–5)",     min: 0,  color: "#ef4444" },
              ].map(({ label, min, color }, idx, arr) => {
                const max = arr[idx - 1]?.min ?? 11;
                const count = allItems.filter((r) => (r.rumor_strength ?? 0) >= min && (r.rumor_strength ?? 0) < max).length;
                return (
                  <div key={label} className="src-bar-item">
                    <div className="src-bar-header">
                      <span>{label}</span>
                      <span className="src-bar-count" style={{ color }}>{fmtNum(count)}</span>
                    </div>
                    <div className="src-bar-track">
                      <div className="src-bar-fill" style={{
                        width: `${allItems.length ? ((count / allItems.length) * 100).toFixed(0) : 0}%`,
                        background: `linear-gradient(90deg,${color},${color}88)`,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="analytics-card">
              <div className="section-title-accent">SOURCE COUNT</div>
              <DonutChart data={[
                { name: "1 source",   value: allItems.filter((i) => i.confirmedByOthers === 1).length, color: "#4a5f75" },
                { name: "2 sources",  value: allItems.filter((i) => i.confirmedByOthers === 2).length, color: "#00e5ff" },
                { name: "3 sources",  value: allItems.filter((i) => i.confirmedByOthers === 3).length, color: "#f59e0b" },
                { name: "4+ sources", value: allItems.filter((i) => i.confirmedByOthers >= 4).length,  color: "#39ff7a" },
              ].filter((d) => d.value > 0)} />
            </div>

            <div className="analytics-card full-width">
              <div className="section-title-gold">💰 TOP FEE TRANSFERS</div>
              <div className="fee-grid">
                {confirmed.filter((t) => t.fee_million > 0)
                  .sort((a, b) => b.fee_million - a.fee_million).slice(0, 8)
                  .map((t, i) => (
                    <div key={t.id} className="fee-card">
                      <div className="fee-card-top">
                        <span className="fee-rank">#{i + 1}</span>
                        <span className="fee-amount">€{fmtNum(t.fee_million)}</span>
                      </div>
                      <div className="fee-player">{t.player}</div>
                      <div className="fee-clubs">{t.from_club} → <span className="fee-to">{t.to_club}</span></div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedPlayer && (
        <PlayerModal
          item={selectedPlayer}
          allItems={allItems}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      <footer className="app-footer">
        TRANSFER TRACKER • PSE INTELLIGENCE ENGINE • AUTO-REFRESH 5min
      </footer>
    </div>
  );
}
