// src/components/BusinessList.jsx
import React, { useState } from 'react';
import { deleteBusiness } from '../services/api';
import BusinessForm from './BusinessForm';

export default function BusinessList({ businesses = [], types = [], onRefresh, onLocate }) {
  const [editing,    setEditing]    = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [delLoading, setDelLoading] = useState(false);

  async function handleDelete(id) {
    setDelLoading(true);
    try {
      await deleteBusiness(id);
      setConfirmDel(null);
      onRefresh?.();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Businesses</span>
        <span style={styles.count}>{businesses.length}</span>
      </div>

      {businesses.length === 0 && (
        <div style={styles.empty}>No businesses found.</div>
      )}

      <div style={styles.list}>
        {businesses.map(b => (
          <div key={b.id} style={styles.row}>
            <div style={styles.rowLeft}>
              <div style={styles.name}>{b.name}</div>
              <div style={styles.meta}>
                <span style={styles.typeBadge}>{b.type?.displayLabel}</span>
                {b.zone && <span style={styles.zoneBadge}>{b.zone.name}</span>}
              </div>
              <div style={styles.coords}>
                {b.lat?.toFixed(5)}, {b.lon?.toFixed(5)}
              </div>
            </div>
            <div style={styles.rowRight}>
              <ScoreDot score={b.demandScore} label="D" title="Demand" />
              <ScoreDot score={b.trafficScore} label="T" title="Traffic" />
              <button
                className="btn btn-sm btn-secondary"
                title="Locate on map"
                onClick={() => onLocate?.(b)}
              >📍</button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setEditing(b)}
              >✏️</button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => setConfirmDel(b)}
              >🗑</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <BusinessForm
          types={types}
          existing={editing}
          onCancel={() => setEditing(null)}
          onSuccess={() => { setEditing(null); onRefresh?.(); }}
        />
      )}

      {confirmDel && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmBox} className="animate-fade-in">
            <div style={styles.confirmTitle}>Delete Business?</div>
            <p style={styles.confirmText}>
              This will permanently delete <strong>{confirmDel.name}</strong> and
              may trigger score recalculations for nearby requests.
            </p>
            <div style={styles.confirmActions}>
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={delLoading}
                onClick={() => handleDelete(confirmDel.id)}
              >
                {delLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreDot({ score, label, title }) {
  const color = score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--yellow)' : 'var(--red)';
  return (
    <div title={`${title}: ${score}`} style={{ ...styles.scoreDot, borderColor: color }}>
      <span style={{ color, fontSize: '9px', fontWeight: 700 }}>{label}</span>
      <span style={{ color, fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: 'var(--text-secondary)',
  },
  count: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '1px 7px',
    fontSize: '11px',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflowY: 'auto',
    flex: 1,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    transition: 'border-color 0.15s',
  },
  rowLeft: { flex: 1, minWidth: 0 },
  name: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: { display: 'flex', gap: '5px', marginTop: '2px', flexWrap: 'wrap' },
  typeBadge: {
    fontSize: '10px',
    padding: '1px 6px',
    background: 'rgba(0,229,255,0.1)',
    color: 'var(--accent)',
    borderRadius: '4px',
    border: '1px solid rgba(0,229,255,0.2)',
  },
  zoneBadge: {
    fontSize: '10px',
    padding: '1px 6px',
    background: 'rgba(0,230,118,0.08)',
    color: 'var(--green)',
    borderRadius: '4px',
    border: '1px solid rgba(0,230,118,0.2)',
  },
  coords: {
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  rowRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    flexShrink: 0,
  },
  scoreDot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2px 5px',
    border: '1px solid',
    borderRadius: '4px',
    minWidth: '30px',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    padding: '20px',
    fontSize: '13px',
  },
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 3000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBox: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    maxWidth: '380px',
    width: '90%',
  },
  confirmTitle: { fontSize: '16px', fontWeight: 700, marginBottom: '10px' },
  confirmText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' },
  confirmActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px' },
};
