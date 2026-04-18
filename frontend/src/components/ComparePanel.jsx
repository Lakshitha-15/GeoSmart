// src/components/ComparePanel.jsx
import React, { useState } from 'react';
import { compareTwoLocations } from '../services/api';

export default function ComparePanel({ types = [], pendingLocation, onClear, onPinModeChange, onLocationsChange }) {
  const [loc1,     setLoc1]     = useState({ lat: '', lon: '' });
  const [loc2,     setLoc2]     = useState({ lat: '', lon: '' });
  const [typeId,   setTypeId]   = useState('');
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [pinMode,  setPinMode]  = useState(null); // 'loc1' | 'loc2'

  // When locations change, notify parent
  React.useEffect(() => {
    onLocationsChange?.({ loc1, loc2 });
  }, [loc1, loc2, onLocationsChange]);

  // When map sends a pending location, fill whichever slot is in pin mode
  React.useEffect(() => {
    if (pendingLocation && pinMode) {
      if (pinMode === 'loc1') setLoc1(pendingLocation);
      if (pinMode === 'loc2') setLoc2(pendingLocation);
      setPinMode(null);
      onPinModeChange?.(null); // Notify parent to disable pin mode
      onClear?.();
    }
  }, [pendingLocation, pinMode, onPinModeChange, onClear]);

  async function handleCompare() {
    if (!loc1.lat || !loc2.lat || !typeId) {
      setError('Fill both locations and select a business type.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await compareTwoLocations({
        lat1: parseFloat(loc1.lat), lon1: parseFloat(loc1.lon),
        lat2: parseFloat(loc2.lat), lon2: parseFloat(loc2.lon),
        typeId: parseInt(typeId),
      });
      console.log('Compare result:', data);
      setResult(data.data); // Access the nested data property
    } catch (err) {
      console.error('Compare error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Compare Two Locations</div>

      <div className="form-group">
        <label>Business Type</label>
        <select style={styles.select} value={typeId} onChange={e => setTypeId(e.target.value)}>
          <option value="">Select type…</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.display_label}</option>)}
        </select>
      </div>

      <div style={styles.locationsGrid}>
        <LocationInput label="Location A" value={loc1} onChange={setLoc1}
          isPin={pinMode === 'loc1'}
          onPin={() => {
            const newMode = pinMode === 'loc1' ? null : 'loc1';
            setPinMode(newMode);
            onPinModeChange?.(newMode);
          }} />
        <LocationInput label="Location B" value={loc2} onChange={setLoc2}
          isPin={pinMode === 'loc2'}
          onPin={() => {
            const newMode = pinMode === 'loc2' ? null : 'loc2';
            setPinMode(newMode);
            onPinModeChange?.(newMode);
          }} />
      </div>

      {pinMode && (
        <div style={styles.pinHint}>
          📍 Click on the map to set <strong>{pinMode === 'loc1' ? 'Location A' : 'Location B'}</strong>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={handleCompare}
        disabled={loading}
      >
        {loading ? '⟳ Comparing…' : '⚖ Compare Locations'}
      </button>

      {result && <CompareResult result={result} />}
    </div>
  );
}

function LocationInput({ label, value, onChange, isPin, onPin }) {
  return (
    <div style={styles.locInput}>
      <div style={styles.locLabel}>
        <span>{label}</span>
        <button
          className={`btn btn-sm ${isPin ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onPin}
          style={{ padding: '2px 7px', fontSize: '11px' }}
        >
          📍 {isPin ? 'Pinning…' : 'Pin'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          type="number" step="any" placeholder="Lat"
          value={value.lat}
          onChange={e => onChange({ ...value, lat: parseFloat(e.target.value) || '' })}
          style={{ flex: 1 }}
        />
        <input
          type="number" step="any" placeholder="Lon"
          value={value.lon}
          onChange={e => onChange({ ...value, lon: parseFloat(e.target.value) || '' })}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
}

function CompareResult({ result }) {
  const l1   = result.location_1?.analysis;
  const l2   = result.location_2?.analysis;
  const dist = result.distance_between_m;
  const winner = result.winner_location;
  const scoreDiff = result.score_difference;

  if (!l1 || !l2) {
    return <div style={styles.error}>Unable to load comparison data</div>;
  }

  const s1 = l1.final_score || 0;
  const s2 = l2.final_score || 0;

  return (
    <div style={styles.compareResult} className="animate-fade-in">
      <div style={styles.resultHeader}>
        <span style={styles.resultTitle}>📊 Comparison Result</span>
        {winner !== 0 && (
          <span style={styles.winnerBadge}>
            Location {winner} wins by {scoreDiff?.toFixed(1)} pts
          </span>
        )}
      </div>

      {/* Score Comparison */}
      <div style={styles.scoreRow}>
        <ScoreCol label="Location A" score={s1} isWinner={winner === 1} />
        <div style={styles.vs}>VS</div>
        <ScoreCol label="Location B" score={s2} isWinner={winner === 2} />
      </div>

      {/* Factor Breakdown */}
      {l1.scores && l2.scores && (
        <>
          <div style={styles.sectionTitle}>Factor Breakdown</div>
          <FactorTable l1={l1.scores} l2={l2.scores} />
        </>
      )}

      {/* Distance */}
      <div style={styles.distRow}>
        <span style={styles.distLabel}>📍 Distance between points:</span>
        <span style={styles.distVal}>{(dist / 1000).toFixed(2)} km</span>
      </div>

      {/* Detailed Analysis */}
      <DetailedAnalysis loc1={l1} loc2={l2} winner={winner} />

      {/* Final Conclusion */}
      <FinalConclusion loc1={l1} loc2={l2} winner={winner} scoreDiff={scoreDiff} />
    </div>
  );
}

function DetailedAnalysis({ loc1, loc2, winner }) {
  return (
    <div style={styles.analysisSection}>
      <div style={styles.sectionTitle}>Detailed Metrics</div>
      <div style={styles.metricsGrid}>
        <MetricItem 
          label="Competition Density"
          value1={loc1.competition_density?.toFixed(2)} 
          value2={loc2.competition_density?.toFixed(2)}
          unit="businesses/km²"
          lowerBetter={true}
        />
        <MetricItem 
          label="Competitor Count"
          value1={loc1.competitor_count} 
          value2={loc2.competitor_count}
          lowerBetter={true}
        />
        <MetricItem 
          label="Road Access"
          value1={loc1.road_count} 
          value2={loc2.road_count}
          label2="roads nearby"
        />
        <MetricItem 
          label="Primary Roads"
          value1={loc1.primary_roads} 
          value2={loc2.primary_roads}
        />
      </div>
    </div>
  );
}

function MetricItem({ label, value1, value2, unit = '', label2 = '', lowerBetter = false }) {
  const v1 = parseFloat(value1) || 0;
  const v2 = parseFloat(value2) || 0;
  const winner = lowerBetter ? (v1 < v2 ? 1 : v1 > v2 ? 2 : 0) : (v1 > v2 ? 1 : v1 < v2 ? 2 : 0);
  
  return (
    <div style={styles.metricItem}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValues}>
        <span style={{ ...styles.metricVal, color: winner === 1 ? 'var(--green)' : 'var(--text-muted)' }}>
          {value1}{unit}
        </span>
        <span style={styles.metricSpacer}>vs</span>
        <span style={{ ...styles.metricVal, color: winner === 2 ? 'var(--green)' : 'var(--text-muted)' }}>
          {value2}{unit}
        </span>
      </div>
      {label2 && <div style={styles.metricHint}>{label2}</div>}
    </div>
  );
}

function FinalConclusion({ loc1, loc2, winner, scoreDiff }) {
  const s1 = loc1.final_score || 0;
  const s2 = loc2.final_score || 0;
  const maxScore = Math.max(s1, s2);
  
  let conclusion = '';
  let icon = '';

  if (winner === 0) {
    conclusion = 'Both locations are equally suitable for this business type.';
    icon = '🤝';
  } else if (scoreDiff > 20) {
    conclusion = `Location ${winner} is significantly more suitable. Consider this location for optimal business viability.`;
    icon = '🎯';
  } else if (scoreDiff > 10) {
    conclusion = `Location ${winner} shows better potential, though Location ${winner === 1 ? 2 : 1} is still viable.`;
    icon = '⚖️';
  } else {
    conclusion = `Location ${winner} has a slight advantage. Both locations are reasonably suitable.`;
    icon = '📊';
  }

  const suitability = maxScore >= 70 ? 'Highly Suitable' : 
                     maxScore >= 50 ? 'Suitable' : 
                     maxScore >= 30 ? 'Marginal' : 
                     'Not Suitable';
  
  const suitColor = maxScore >= 70 ? 'var(--green)' : 
                   maxScore >= 50 ? 'var(--yellow)' : 
                   'var(--red)';

  return (
    <div style={{ ...styles.conclusionSection, borderColor: suitColor }}>
      <div style={styles.conclusionTitle}>
        <span>{icon}</span> Final Conclusion
      </div>
      <div style={styles.conclusionText}>{conclusion}</div>
      <div style={styles.suitabilityBadge}>
        <span style={{ color: suitColor }}>●</span> Overall: <strong style={{ color: suitColor }}>{suitability}</strong>
      </div>
    </div>
  );
}

function ScoreCol({ label, score, isWinner }) {
  const color = score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--yellow)' : 'var(--red)';
  return (
    <div style={{ ...styles.scoreCol, ...(isWinner ? styles.winnerCol : {}) }}>
      {isWinner && <div style={styles.winnerCrown}>👑 Winner</div>}
      <div style={{ ...styles.bigScore, color }}>{score?.toFixed(1)}</div>
      <div style={styles.colLabel}>{label}</div>
    </div>
  );
}

function FactorTable({ l1, l2 }) {
  const factors = [
    { key: 'competition', label: 'Competition' },
    { key: 'demand',      label: 'Demand' },
    { key: 'road_access', label: 'Road Access' },
    { key: 'zone_fit',    label: 'Zone Fit' },
  ];
  return (
    <div style={styles.factorTable}>
      {factors.map(f => {
        const v1 = l1?.[f.key] ?? 0;
        const v2 = l2?.[f.key] ?? 0;
        return (
          <div key={f.key} style={styles.factorRow}>
            <span style={{ ...styles.fVal, color: v1 >= v2 ? 'var(--green)' : 'var(--text-muted)' }}>
              {v1.toFixed(0)}
            </span>
            <span style={styles.fLabel}>{f.label}</span>
            <span style={{ ...styles.fVal, color: v2 > v1 ? 'var(--green)' : 'var(--text-muted)' }}>
              {v2.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '10px' },
  header: {
    fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
    paddingBottom: '8px', borderBottom: '1px solid var(--border)',
  },
  select: { width: '100%' },
  locationsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  locInput: { display: 'flex', flexDirection: 'column', gap: '5px' },
  locLabel: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  pinHint: {
    background: 'rgba(0,229,255,0.08)',
    border: '1px solid rgba(0,229,255,0.25)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 10px',
    fontSize: '12px',
    color: 'var(--accent)',
    textAlign: 'center',
  },
  error: {
    background: 'rgba(255,82,82,0.1)',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--red)',
    padding: '8px 10px',
    fontSize: '12px',
  },
  compareResult: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resultTitle: { fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  winnerBadge: {
    fontSize: '11px',
    background: 'rgba(0,230,118,0.12)',
    color: 'var(--green)',
    border: '1px solid rgba(0,230,118,0.25)',
    borderRadius: '4px',
    padding: '2px 8px',
  },
  scoreRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  scoreCol: {
    flex: 1, textAlign: 'center', padding: '10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
  },
  winnerCol: { border: '1px solid rgba(0,230,118,0.4)', background: 'rgba(0,230,118,0.05)' },
  winnerCrown: { fontSize: '10px', color: 'var(--green)', marginBottom: '2px' },
  bigScore: { fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-mono)' },
  colLabel: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' },
  vs: { fontWeight: 800, color: 'var(--text-muted)', fontSize: '14px' },
  factorTable: { display: 'flex', flexDirection: 'column', gap: '4px' },
  factorRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '4px 8px',
    background: 'var(--bg-panel)',
    borderRadius: '4px',
  },
  fVal: { fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, minWidth: '30px', textAlign: 'center' },
  fLabel: { flex: 1, fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' },
  distRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: '12px', color: 'var(--text-muted)',
    borderTop: '1px solid var(--border)', paddingTop: '8px',
  },
  distLabel: {},
  distVal: { fontFamily: 'var(--font-mono)', color: 'var(--accent)' },
  sectionTitle: {
    fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', 
    textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px', marginBottom: '8px'
  },
  analysisSection: {
    borderTop: '1px solid var(--border)',
    paddingTop: '12px',
  },
  metricsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
  },
  metricItem: {
    background: 'var(--bg-panel)',
    borderRadius: '4px',
    padding: '8px',
    fontSize: '10px',
  },
  metricLabel: {
    color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px', fontWeight: 600
  },
  metricValues: {
    display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '4px',
  },
  metricVal: {
    fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700
  },
  metricSpacer: {
    fontSize: '9px', color: 'var(--text-muted)'
  },
  metricHint: {
    fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', textAlign: 'center'
  },
  conclusionSection: {
    background: 'rgba(0,229,255,0.05)',
    border: '2px solid var(--accent)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    marginTop: '8px',
  },
  conclusionTitle: {
    fontSize: '12px', fontWeight: 700, color: 'var(--accent)',
    display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px'
  },
  conclusionText: {
    fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.4', marginBottom: '8px'
  },
  suitabilityBadge: {
    fontSize: '11px', color: 'var(--text-secondary)',
    padding: '6px 8px', background: 'var(--bg-panel)', borderRadius: '4px',
    display: 'flex', alignItems: 'center', gap: '4px'
  },
};
