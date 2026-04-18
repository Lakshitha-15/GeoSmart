// src/components/ScorePanel.jsx
import React from 'react';

const SCORE_FACTORS = [
  { key: 'competition', label: 'Competition', icon: '⚔️', desc: 'Inverse competitor density' },
  { key: 'demand',      label: 'Demand',      icon: '📈', desc: 'Area footfall & demand signals' },
  { key: 'road_access', label: 'Road Access', icon: '🛣️', desc: 'Road connectivity within 200m' },
  { key: 'zone_fit',    label: 'Zone Fit',    icon: '🗺️', desc: 'Zone type compatibility' },
];

function getScoreColor(score) {
  if (score >= 70) return 'var(--score-high)';
  if (score >= 50) return 'var(--score-mid)';
  if (score >= 30) return 'var(--score-low)';
  return 'var(--score-bad)';
}

function getRecTag(type) {
  const map = {
    highly_suitable: { label: 'Highly Suitable', color: 'var(--green)',  bg: 'rgba(0,230,118,0.12)' },
    suitable:        { label: 'Suitable',         color: 'var(--yellow)', bg: 'rgba(255,215,64,0.12)' },
    marginal:        { label: 'Marginal',          color: 'var(--orange)', bg: 'rgba(255,145,0,0.12)' },
    not_suitable:    { label: 'Not Suitable',      color: 'var(--red)',    bg: 'rgba(255,82,82,0.12)'  },
  };
  return map[type] || map.marginal;
}

export default function ScorePanel({ result, onClose }) {
  if (!result) return null;

  const { finalScore, scores, weights, recommendation, competitors,
          competitorCount, zone, roadCount, primaryRoads } = result;

  const recInfo = getRecTag(recommendation?.recommendation_type);

  return (
    <div style={styles.panel} className="animate-fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerLabel}>Location Analysis</div>
          <div style={styles.coordText}>
            {result.lat?.toFixed(5)}, {result.lon?.toFixed(5)}
          </div>
        </div>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>

      {/* Final Score Ring */}
      <div style={styles.scoreSection}>
        <ScoreRing score={finalScore} />
        <div style={styles.recBadge}>
          <span style={{
            ...styles.recTag,
            color: recInfo.color,
            background: recInfo.bg,
            border: `1px solid ${recInfo.color}33`,
          }}>
            {recInfo.label}
          </span>
          <div style={styles.recTitle}>{recommendation?.title}</div>
        </div>
      </div>

      {/* Factor Scores */}
      <div style={styles.factorsGrid}>
        {SCORE_FACTORS.map(f => {
          const raw = scores?.[f.key] ?? 0;
          const w   = weights?.[f.key] ?? 0;
          return (
            <div key={f.key} style={styles.factorCard}>
              <div style={styles.factorTop}>
                <span style={styles.factorIcon}>{f.icon}</span>
                <span style={styles.factorLabel}>{f.label}</span>
                <span style={{ ...styles.factorScore, color: getScoreColor(raw) }}>
                  {raw.toFixed(0)}
                </span>
              </div>
              <div style={styles.barTrack}>
                <div style={{
                  ...styles.barFill,
                  width: `${raw}%`,
                  background: getScoreColor(raw),
                }} />
              </div>
              <div style={styles.factorMeta}>
                <span style={styles.factorDesc}>{f.desc}</span>
                <span style={styles.factorWeight}>×{w}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Explanation</div>
        <p style={styles.bodyText}>{recommendation?.body}</p>
      </div>

      {/* Pros & Cons */}
      {(recommendation?.pros?.length > 0 || recommendation?.cons?.length > 0) && (
        <div style={styles.prosConsGrid}>
          {recommendation.pros?.length > 0 && (
            <div>
              <div style={{ ...styles.sectionTitle, color: 'var(--green)' }}>✓ Strengths</div>
              <ul style={styles.list}>
                {recommendation.pros.map((p, i) => (
                  <li key={i} style={{ ...styles.listItem, color: 'var(--green)' }}>
                    <span style={styles.listDot}>•</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recommendation.cons?.length > 0 && (
            <div>
              <div style={{ ...styles.sectionTitle, color: 'var(--red)' }}>✗ Concerns</div>
              <ul style={styles.list}>
                {recommendation.cons.map((c, i) => (
                  <li key={i} style={{ ...styles.listItem, color: 'var(--red)' }}>
                    <span style={styles.listDot}>•</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Stats Row */}
      <div style={styles.statsRow}>
        <Stat label="Competitors" value={competitorCount} />
        <Stat label="Roads 200m"  value={roadCount} />
        <Stat label="Primary Rds" value={primaryRoads} />
        {zone && <Stat label="Zone" value={zone.type?.replace('_', ' ')} capitalize />}
      </div>

      {/* Nearby Competitors */}
      {competitors?.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Nearby Competitors ({competitors.length})</div>
          <div style={styles.competitorList}>
            {competitors.slice(0, 5).map(c => (
              <div key={c.id} style={styles.competitorRow}>
                <div style={styles.compName}>{c.name}</div>
                <div style={styles.compDist}>{c.distanceM}m</div>
              </div>
            ))}
            {competitors.length > 5 && (
              <div style={styles.moreText}>+{competitors.length - 5} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (score || 0) / 100);
  const color = getScoreColor(score);

  return (
    <div style={styles.ringWrapper}>
      <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-hover)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ ...styles.ringScore, color }}>
        {(score || 0).toFixed(0)}
      </div>
    </div>
  );
}

function Stat({ label, value, capitalize }) {
  return (
    <div style={styles.statBox}>
      <div style={{ ...styles.statVal, textTransform: capitalize ? 'capitalize' : 'none' }}>
        {value ?? '—'}
      </div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  panel: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxHeight: 'calc(100vh - 140px)',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-card)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLabel: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'var(--accent)',
    marginBottom: '2px',
  },
  coordText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
    lineHeight: 1,
  },
  scoreSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  ringWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    flexShrink: 0,
  },
  ringScore: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontFamily: 'var(--font-mono)',
    fontSize: '22px',
    fontWeight: 700,
  },
  recBadge: { flex: 1 },
  recTag: {
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'inline-block',
    marginBottom: '6px',
  },
  recTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  },
  factorsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  factorCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px',
  },
  factorTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
  },
  factorIcon: { fontSize: '14px' },
  factorLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    flex: 1,
  },
  factorScore: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: 700,
  },
  barTrack: {
    height: '4px',
    background: 'var(--bg-hover)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  barFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.6s ease',
  },
  factorMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorDesc: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  factorWeight: {
    fontSize: '10px',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
  },
  section: {},
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
  },
  bodyText: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    lineHeight: 1.7,
  },
  prosConsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  list: { listStyle: 'none' },
  listItem: {
    display: 'flex',
    gap: '6px',
    fontSize: '12px',
    marginBottom: '4px',
    lineHeight: 1.4,
  },
  listDot: { flexShrink: 0, fontWeight: 700 },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  statBox: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px',
    textAlign: 'center',
  },
  statVal: {
    fontSize: '16px',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent)',
  },
  statLabel: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  competitorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  competitorRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 8px',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
  },
  compName: { fontSize: '12px', color: 'var(--text-primary)' },
  compDist: {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  moreText: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '4px',
  },
};
