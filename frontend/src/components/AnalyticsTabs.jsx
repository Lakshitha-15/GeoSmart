// src/components/AnalyticsTabs.jsx
import React, { useState } from 'react';
import { getTopRanked, getLowCompetition, getUnderserved, getBestLocations } from '../services/api';

const TABS = ['Top Ranked', 'Low Competition', 'Underserved', 'Best Locations'];

export default function AnalyticsTabs({ types = [], onHighlight }) {
  const [activeTab,   setActiveTab]   = useState(0);
  const [results,     setResults]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [selectedType, setSelectedType] = useState('');

  async function runQuery(tabIdx) {
    if (!selectedType && tabIdx !== 0) {
      setError('Select a business type first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let data;
      switch (tabIdx) {
        case 0:
          data = (await getTopRanked({ typeId: selectedType || undefined, limit: 10 })).data;
          break;
        case 1:
          data = (await getLowCompetition({ typeId: selectedType })).data;
          break;
        case 2:
          data = (await getUnderserved({ typeId: selectedType, minPopulation: 2000 })).data;
          break;
        case 3:
          data = (await getBestLocations(selectedType, { top: 10 })).data;
          break;
        default:
          data = [];
      }
      setResults(data || []);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleTabChange(i) {
    setActiveTab(i);
    setResults([]);
    setError(null);
  }

  return (
    <div style={styles.container}>
      {/* Tab bar */}
      <div style={styles.tabs}>
        {TABS.map((t, i) => (
          <button
            key={t}
            style={{ ...styles.tab, ...(activeTab === i ? styles.tabActive : {}) }}
            onClick={() => handleTabChange(i)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <select
          style={styles.select}
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
        >
          <option value="">All types</option>
          {types.map(t => (
            <option key={t.id} value={t.id}>{t.display_label}</option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={() => runQuery(activeTab)}
          disabled={loading}
        >
          {loading ? <span className="spin" style={{ display: 'inline-block' }}>⟳</span> : '▶ Run'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Results */}
      <div style={styles.results}>
        {results.length === 0 && !loading && (
          <div style={styles.empty}>Select a type and run the query.</div>
        )}
        {results.map((r, i) => (
          <ResultRow key={i} row={r} tab={activeTab} index={i} onHighlight={onHighlight} />
        ))}
      </div>
    </div>
  );
}

function ResultRow({ row, tab, index, onHighlight }) {
  const hasCoords = row.lat != null && row.lon != null;
  const score = row.composite_score ?? row.final_score ?? row.opportunity_score ?? row.underserved_score;

  return (
    <div style={styles.resultRow}>
      <div style={styles.resultRank}>
        {row.rank ? `#${row.rank}` : `${index + 1}`}
      </div>
      <div style={styles.resultBody}>
        <div style={styles.resultName}>
          {row.business_name || row.zone_name || `${parseFloat(row.lat)?.toFixed(4)}, ${parseFloat(row.lon)?.toFixed(4)}`}
        </div>
        <div style={styles.resultMeta}>
          {row.zone_type && <Tag label={row.zone_type} color="var(--accent)" />}
          {row.type_name  && <Tag label={row.type_name}  color="var(--text-muted)" />}
          {row.business_count != null && <Tag label={`${row.business_count} biz`} color="var(--yellow)" />}
        </div>
      </div>
      {score != null && (
        <div style={{
          ...styles.resultScore,
          color: score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--yellow)' : 'var(--red)',
        }}>
          {parseFloat(score).toFixed(1)}
        </div>
      )}
      {hasCoords && (
        <button
          className="btn btn-sm btn-secondary"
          style={{ marginLeft: '4px', flexShrink: 0 }}
          title="Show on map"
          onClick={() => onHighlight?.(parseFloat(row.lat), parseFloat(row.lon))}
        >
          📍
        </button>
      )}
    </div>
  );
}

function Tag({ label, color }) {
  return (
    <span style={{ fontSize: '10px', color, textTransform: 'capitalize' }}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
    minHeight: 0,
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
  },
  tab: {
    padding: '6px 4px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'rgba(0,229,255,0.1)',
    borderColor: 'var(--accent)',
    color: 'var(--accent)',
  },
  controls: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  select: {
    flex: 1,
    padding: '7px 10px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '12px',
  },
  error: {
    background: 'rgba(255,82,82,0.1)',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--red)',
    padding: '8px 10px',
    fontSize: '12px',
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflowY: 'auto',
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '12px',
    padding: '20px',
  },
  resultRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
  resultRank: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-muted)',
    minWidth: '24px',
  },
  resultBody: { flex: 1, minWidth: 0 },
  resultName: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resultMeta: {
    display: 'flex',
    gap: '8px',
    marginTop: '2px',
  },
  resultScore: {
    fontFamily: 'var(--font-mono)',
    fontSize: '15px',
    fontWeight: 700,
    flexShrink: 0,
  },
};
