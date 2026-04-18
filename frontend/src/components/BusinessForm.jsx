// src/components/BusinessForm.jsx
import React, { useState } from 'react';
import { createBusiness, updateBusiness } from '../services/api';

export default function BusinessForm({ types = [], onSuccess, onCancel, existing = null }) {
  const [form, setForm] = useState({
    name:         existing?.name         || '',
    lat:          existing?.lat          || '',
    lon:          existing?.lon          || '',
    address:      existing?.address      || '',
    typeId:       existing?.type?.typeId || '',
    demandScore:  existing?.demandScore  || 50,
    trafficScore: existing?.trafficScore || 50,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (existing) {
        await updateBusiness(existing.id, form);
      } else {
        await createBusiness(form);
      }
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="animate-fade-in">
        <div style={styles.header}>
          <span style={styles.title}>{existing ? 'Edit Business' : 'Add New Business'}</span>
          <button onClick={onCancel} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Business Name *</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Morning Brew Café" required />
          </div>

          <div style={styles.row}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Latitude *</label>
              <input type="number" step="any" value={form.lat} onChange={set('lat')}
                placeholder="11.0168" required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Longitude *</label>
              <input type="number" step="any" value={form.lon} onChange={set('lon')}
                placeholder="76.9558" required />
            </div>
          </div>

          <div className="form-group">
            <label>Business Type *</label>
            <select value={form.typeId} onChange={set('typeId')} required>
              <option value="">Select type…</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.display_label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Address</label>
            <input value={form.address} onChange={set('address')} placeholder="Street, Area, City" />
          </div>

          <div style={styles.row}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Demand Score (0–100)</label>
              <input type="number" min="0" max="100" step="1"
                value={form.demandScore} onChange={set('demandScore')} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Traffic Score (0–100)</label>
              <input type="number" min="0" max="100" step="1"
                value={form.trafficScore} onChange={set('trafficScore')} />
            </div>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <div style={styles.actions}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Saving…' : (existing ? '✓ Update' : '+ Add Business')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: 'var(--shadow-card)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '18px',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  errorBox: {
    background: 'rgba(255,82,82,0.12)',
    border: '1px solid rgba(255,82,82,0.3)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--red)',
    padding: '10px 12px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '16px',
  },
};
