// src/components/ComparePanel.jsx
import React, { useState } from 'react';
import { compareTwoLocations } from '../services/api';

export default function ComparePanel({ types = [], pendingLocation, onClear }) {
  const [loc1,     setLoc1]     = useState({ lat: '', lon: '' });
  const [loc2,     setLoc2]     = useState({ lat: '', lon: '' });
  const [typeId,   setTypeId]   = useState('');
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [pinMode,  setPinMode]  = useState(null); // 'loc1' | 'loc2'

  // When map sends a pending location, fill whichever slot is in pin mode
  React.useEffect(() => {
    if (pendingLocation && pinMode) {
      if (pinMode === 'loc1') setLoc1(pendingLocation);
      if (pinMode === 'loc2') setLoc2(pendingLocation);
      setPinMode(null);
      onClear?.();
    }
  }, [pendingLocation]);

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
      setResult(data);
    } catch (err) {
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
          onPin={() => setPinMode(pinMode === 'loc1' ? null : 'loc1')} />
        <LocationInput label="Location B" value={loc2} onChange={setLoc2}
          isPin={pinMode === 'loc2'}
          onPin={() => setPinMode(pinMode === 'loc2' ? null : 'loc2')} />
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
          onChange={e => onChange(v => ({ ...v, lat: e.target.value }))}
          style={{ flex: 1 }}
        />
        <input
          type="number" step="any" placeholder="Lon"
          value={value.lon}
          onChange={e => onChange(v => ({ ...v, lon: e.target.value }))}
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

  if (!l1 || !l2) return null;

  return (
    <div style={styles.compareResult} className="animate-fade-in">
      <div style={styles.resultHeader}>
        <span style={styles.resultTitle}>Comparison Result</span>
        {winner !== 0 && (
          <span style={styles.winnerBadge}>
            Location {winner} wins by {result.score_difference?.toFixed(1)} pts
          </span>
        )}
      </div>

      <div style={styles.scoreRow}>
        <ScoreCol label="Location A" score={l1.final_score} isWinner={winner === 1} />
        <div style={styles.vs}>VS</div>
        <ScoreCol label="Location B" score={l2.final_score} isWinner={winner === 2} />
      </div>

      <FactorTable l1={l1.scores} l2={l2.scores} />

      <div style={styles.distRow}>
        <span style={styles.distLabel}>Distance between points:</span>
        <span style={styles.distVal}>{Math.round(dist)} m</span>
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
};
