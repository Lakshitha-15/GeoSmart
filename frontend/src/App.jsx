// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, CircleMarker,
  Polygon, useMapEvents, useMap
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles/globals.css';

import { getBusinessTypes, getBusinesses, getZones, analyzeLocation } from './services/api';
import ScorePanel     from './components/ScorePanel';
import BusinessForm   from './components/BusinessForm';
import BusinessList   from './components/BusinessList';
import AnalyticsTabs  from './components/AnalyticsTabs';
import ComparePanel   from './components/ComparePanel';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const COIMBATORE_CENTER = [11.0168, 76.9558];
const SIDEBAR_TABS = ['Analyze', 'Businesses', 'Analytics', 'Compare'];
const ZONE_COLORS = {
  commercial: '#00e5ff',
  residential:'#00e676',
  industrial: '#ff9100',
  mixed:      '#ffd740',
  green:      '#69f0ae',
};

// ── Map click handler ─────────────────────────────────────────
function MapClickHandler({ onMapClick, comparePinMode }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Fly-to helper ─────────────────────────────────────────────
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], 15, { duration: 1.2 });
  }, [target]);
  return null;
}

// ─────────────────────────────────────────────────────────────
export default function App() {
  const [types,          setTypes]          = useState([]);
  const [businesses,     setBusinesses]     = useState([]);
  const [zones,          setZones]          = useState([]);
  const [selectedType,   setSelectedType]   = useState('');
  const [analyzing,      setAnalyzing]      = useState(false);
  const [analyzeResult,  setAnalyzeResult]  = useState(null);
  const [clickedMarker,  setClickedMarker]  = useState(null);
  const [activeTab,      setActiveTab]      = useState(0);
  const [showAddForm,    setShowAddForm]    = useState(false);
  const [showZones,      setShowZones]      = useState(true);
  const [flyTarget,      setFlyTarget]      = useState(null);
  const [comparePin,     setComparePin]     = useState(null);
  const [comparePinMode, setComparePinMode] = useState(false);
  const [compareLocations, setCompareLocations] = useState({ loc1: {}, loc2: {} });
  const [error,          setError]          = useState(null);

  // Initial data load
  useEffect(() => {
    Promise.all([
      getBusinessTypes().then(r => setTypes(r.data || [])),
      loadBusinesses(),
      getZones().then(r => setZones(r.data || [])),
    ]).catch(err => setError('Failed to connect to API: ' + err.message));
  }, []);

  async function loadBusinesses() {
    try {
      const r = await getBusinesses();
      setBusinesses(r.data || []);
    } catch (err) {
      console.error('Load businesses failed:', err);
    }
  }

  const handleMapClick = useCallback(async (lat, lon) => {
    // If in compare-pin mode, return the pin to ComparePanel
    if (comparePinMode) {
      setComparePin({ lat, lon });
      setComparePinMode(false);
      return;
    }

    if (!selectedType) {
      setError('Please select a business type first.');
      return;
    }
    setError(null);
    setClickedMarker({ lat, lon });
    setAnalyzeResult(null);
    setAnalyzing(true);
    setActiveTab(0);

    try {
      const result = await analyzeLocation({
        lat, lon,
        typeId: parseInt(selectedType),
        radiusM: 1000,
      });
      setAnalyzeResult(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }, [selectedType, comparePinMode]);

  function getScoreColor(score) {
    if (!score) return '#556688';
    if (score >= 70) return '#00e676';
    if (score >= 50) return '#ffd740';
    if (score >= 30) return '#ff9100';
    return '#ff5252';
  }

  return (
    <div style={layout.root}>
      {/* ── TOP BAR ───────────────────────────────────────── */}
      <header style={layout.topbar}>
        <div style={layout.brand}>
          <span style={layout.brandIcon}>◈</span>
          <span style={layout.brandName}>GeoSmart</span>
          <span style={layout.brandSub}>Location Intelligence</span>
        </div>

        <div style={layout.typeSelector}>
          <span style={layout.selectorLabel}>BUSINESS TYPE</span>
          <select
            style={layout.typeSelect}
            value={selectedType}
            onChange={e => { setSelectedType(e.target.value); setAnalyzeResult(null); }}
          >
            <option value="">Click map to analyze…</option>
            {types.map(t => (
              <option key={t.id} value={t.id}>
                {t.display_label}
              </option>
            ))}
          </select>
        </div>

        <div style={layout.topActions}>
          <label style={layout.toggleLabel}>
            <input
              type="checkbox"
              checked={showZones}
              onChange={e => setShowZones(e.target.checked)}
              style={{ accentColor: 'var(--accent)', marginRight: '5px' }}
            />
            Zones
          </label>
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            + Add Business
          </button>
        </div>
      </header>

      <div style={layout.body}>
        {/* ── MAP ───────────────────────────────────────────── */}
        <div style={layout.mapArea}>
          {comparePinMode && (
            <div style={layout.pinBanner}>
              📍 Click on map to place comparison pin
            </div>
          )}
          {analyzing && (
            <div style={layout.analyzingOverlay}>
              <div style={layout.analyzingBox}>
                <span className="spin" style={{ display: 'inline-block', fontSize: '20px' }}>⟳</span>
                <span>Analyzing location…</span>
              </div>
            </div>
          )}

          <MapContainer
            center={COIMBATORE_CENTER}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={19}
            />

            <MapClickHandler
              onMapClick={handleMapClick}
              comparePinMode={comparePinMode}
            />
            {flyTarget && <FlyTo target={flyTarget} />}

            {/* Zone overlays */}
            {showZones && zones.map(z => (
              z.geometry?.coordinates && (
                <Polygon
                  key={z.id}
                  positions={z.geometry.coordinates[0].map(([lon, lat]) => [lat, lon])}
                  pathOptions={{
                    color:       ZONE_COLORS[z.zone_type] || '#ffffff',
                    fillColor:   ZONE_COLORS[z.zone_type] || '#ffffff',
                    fillOpacity: 0.08,
                    weight:      1,
                    opacity:     0.5,
                    dashArray:   '4 4',
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'var(--font-body)', minWidth: 160 }}>
                      <strong style={{ color: 'var(--accent)' }}>{z.name}</strong><br />
                      <span style={{ textTransform: 'capitalize' }}>{z.zone_type}</span> zone<br />
                      Pop density: {z.population_density?.toLocaleString() || 'N/A'} /km²<br />
                      Area: {z.area_sqkm} km²
                    </div>
                  </Popup>
                </Polygon>
              )
            ))}

            {/* Business markers */}
            {businesses.map(b => (
              <CircleMarker
                key={b.id}
                center={[b.lat, b.lon]}
                radius={5}
                pathOptions={{
                  color:       '#0a0f1a',
                  fillColor:   b.type?.name === selectedType ? 'var(--accent)' : '#4a7aab',
                  fillOpacity: 0.9,
                  weight:      1.5,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'var(--font-body)', minWidth: 180 }}>
                    <strong style={{ color: 'var(--accent)' }}>{b.name}</strong><br />
                    <em style={{ color: 'var(--text-muted)' }}>{b.type?.displayLabel}</em><br />
                    {b.address && <><span>{b.address}</span><br /></>}
                    {b.zone && <><span>Zone: {b.zone.name}</span><br /></>}
                    <span>Demand: {b.demandScore?.toFixed(0)} | Traffic: {b.trafficScore?.toFixed(0)}</span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Clicked analysis marker */}
            {clickedMarker && (
              <CircleMarker
                center={[clickedMarker.lat, clickedMarker.lon]}
                radius={10}
                pathOptions={{
                  color:       analyzeResult ? getScoreColor(analyzeResult.finalScore) : '#ffffff',
                  fillColor:   analyzeResult ? getScoreColor(analyzeResult.finalScore) : '#ffffff',
                  fillOpacity: 0.3,
                  weight:      2.5,
                }}
              />
            )}

            {/* Competitor markers from analysis */}
            {analyzeResult?.competitors?.map(c => (
              <CircleMarker
                key={c.id}
                center={[c.lat, c.lon]}
                radius={7}
                pathOptions={{
                  color:       '#ff5252',
                  fillColor:   '#ff5252',
                  fillOpacity: 0.6,
                  weight:      1.5,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'var(--font-body)' }}>
                    <strong style={{ color: '#ff5252' }}>⚔ Competitor</strong><br />
                    {c.name}<br />
                    <span style={{ color: 'var(--text-muted)' }}>{c.distanceM}m away</span>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Compare location A marker */}
            {compareLocations.loc1?.lat && compareLocations.loc1?.lon && (
              <CircleMarker
                center={[compareLocations.loc1.lat, compareLocations.loc1.lon]}
                radius={10}
                pathOptions={{
                  color:       '#00bcd4',
                  fillColor:   '#00bcd4',
                  fillOpacity: 0.5,
                  weight:      2,
                  dashArray:   '4 4',
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'var(--font-body)' }}>
                    <strong style={{ color: '#00bcd4' }}>📍 Location A</strong><br />
                    {compareLocations.loc1.lat.toFixed(4)}, {compareLocations.loc1.lon.toFixed(4)}
                  </div>
                </Popup>
              </CircleMarker>
            )}

            {/* Compare location B marker */}
            {compareLocations.loc2?.lat && compareLocations.loc2?.lon && (
              <CircleMarker
                center={[compareLocations.loc2.lat, compareLocations.loc2.lon]}
                radius={10}
                pathOptions={{
                  color:       '#ffa500',
                  fillColor:   '#ffa500',
                  fillOpacity: 0.5,
                  weight:      2,
                  dashArray:   '4 4',
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'var(--font-body)' }}>
                    <strong style={{ color: '#ffa500' }}>📍 Location B</strong><br />
                    {compareLocations.loc2.lat.toFixed(4)}, {compareLocations.loc2.lon.toFixed(4)}
                  </div>
                </Popup>
              </CircleMarker>
            )}
          </MapContainer>

          {/* Map legend */}
          <div style={layout.legend}>
            <div style={layout.legendTitle}>LEGEND</div>
            <LegendItem color="#4a7aab" label="Business" circle />
            <LegendItem color="var(--accent)" label="Selected type" circle />
            <LegendItem color="#ff5252" label="Competitor" circle />
            <LegendItem color="var(--green)" label="Click marker" circle />
            <LegendItem color="#00bcd4" label="Location A" circle />
            <LegendItem color="#ffa500" label="Location B" circle />
            <div style={{ marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
              {Object.entries(ZONE_COLORS).map(([k, v]) => (
                <LegendItem key={k} color={v} label={k} rect />
              ))}
            </div>
          </div>
        </div>

        {/* ── SIDEBAR ─────────────────────────────────────── */}
        <div style={layout.sidebar}>
          {/* Tab navigation */}
          <div style={layout.tabs}>
            {SIDEBAR_TABS.map((t, i) => (
              <button
                key={t}
                style={{ ...layout.tab, ...(activeTab === i ? layout.tabActive : {}) }}
                onClick={() => setActiveTab(i)}
              >
                {t}
              </button>
            ))}
          </div>

          {error && (
            <div style={layout.errorBanner}>
              ⚠ {error}
              <button onClick={() => setError(null)} style={layout.errorClose}>✕</button>
            </div>
          )}

          <div style={layout.tabContent}>
            {/* Tab 0: Analyze */}
            {activeTab === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                {!selectedType && !analyzeResult && (
                  <div style={layout.hint}>
                    <div style={layout.hintIcon}>🎯</div>
                    <div>
                      <strong>How to analyze:</strong>
                      <ol style={layout.hintList}>
                        <li>Select a business type above</li>
                        <li>Click anywhere on the map</li>
                        <li>Get instant suitability analysis</li>
                      </ol>
                    </div>
                  </div>
                )}
                {selectedType && !analyzeResult && !analyzing && (
                  <div style={layout.readyHint}>
                    <span style={{ fontSize: '20px' }}>👆</span>
                    <span>Click on the map to analyze this location</span>
                  </div>
                )}
                {analyzeResult && (
                  <ScorePanel
                    result={analyzeResult}
                    onClose={() => { setAnalyzeResult(null); setClickedMarker(null); }}
                  />
                )}
              </div>
            )}

            {/* Tab 1: Businesses */}
            {activeTab === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <select
                    style={{ flex: 1, marginRight: '8px', fontSize: '12px', padding: '6px 8px' }}
                    onChange={e => getBusinesses({ typeId: e.target.value || undefined })
                      .then(r => setBusinesses(r.data || []))}
                  >
                    <option value="">All types</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.display_label}</option>)}
                  </select>
                  <button className="btn btn-sm btn-secondary" onClick={loadBusinesses}>↻</button>
                </div>
                <BusinessList
                  businesses={businesses}
                  types={types}
                  onRefresh={loadBusinesses}
                  onLocate={b => setFlyTarget(b)}
                />
              </div>
            )}

            {/* Tab 2: Analytics */}
            {activeTab === 2 && (
              <AnalyticsTabs
                types={types}
                onHighlight={(lat, lon) => setFlyTarget({ lat, lon })}
              />
            )}

            {/* Tab 3: Compare */}
            {activeTab === 3 && (
              <ComparePanel
                types={types}
                pendingLocation={comparePin}
                onClear={() => setComparePin(null)}
                onPinModeChange={mode => setComparePinMode(!!mode)}
                onLocationsChange={locs => setCompareLocations(locs)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Add Business Modal */}
      {showAddForm && (
        <BusinessForm
          types={types}
          onCancel={() => setShowAddForm(false)}
          onSuccess={() => { setShowAddForm(false); loadBusinesses(); }}
        />
      )}
    </div>
  );
}

function LegendItem({ color, label, circle, rect }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
      <div style={{
        width: circle ? 10 : 12,
        height: circle ? 10 : 8,
        borderRadius: circle ? '50%' : '2px',
        background: color,
        opacity: 0.8,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
        {label}
      </span>
    </div>
  );
}

// ── Layout styles ─────────────────────────────────────────────
const layout = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-deep)',
    overflow: 'hidden',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 20px',
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    zIndex: 100,
  },
  brand: { display: 'flex', alignItems: 'center', gap: '8px' },
  brandIcon: { color: 'var(--accent)', fontSize: '20px' },
  brandName: {
    fontSize: '18px',
    fontWeight: 800,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
  },
  brandSub: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  typeSelector: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  selectorLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.8px',
    whiteSpace: 'nowrap',
  },
  typeSelect: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    padding: '7px 10px',
    flex: 1,
    maxWidth: '300px',
  },
  topActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    textTransform: 'none',
    fontWeight: 400,
    marginBottom: 0,
  },
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  pinBanner: {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    background: 'var(--accent)',
    color: 'var(--bg-deep)',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: 'var(--shadow-glow)',
  },
  analyzingOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10,15,26,0.4)',
    pointerEvents: 'none',
  },
  analyzingBox: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    fontWeight: 500,
    boxShadow: 'var(--shadow-card)',
  },
  legend: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    zIndex: 800,
    background: 'rgba(17,24,39,0.92)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    backdropFilter: 'blur(8px)',
  },
  legendTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.8px',
    marginBottom: '6px',
  },
  sidebar: {
    width: '360px',
    flexShrink: 0,
    background: 'var(--bg-panel)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  tab: {
    padding: '10px 4px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'var(--font-body)',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottomColor: 'var(--accent)',
    background: 'rgba(0,229,255,0.05)',
  },
  errorBanner: {
    background: 'rgba(255,82,82,0.1)',
    borderBottom: '1px solid rgba(255,82,82,0.25)',
    color: 'var(--red)',
    padding: '8px 12px',
    fontSize: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  errorClose: {
    background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '14px',
  },
  tabContent: {
    flex: 1,
    padding: '14px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  hint: {
    display: 'flex',
    gap: '12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  hintIcon: { fontSize: '24px', flexShrink: 0 },
  hintList: {
    paddingLeft: '16px',
    marginTop: '4px',
    lineHeight: 1.8,
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  readyHint: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '40px 20px',
    color: 'var(--accent)',
    fontSize: '14px',
    fontWeight: 500,
    textAlign: 'center',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-md)',
    animation: 'pulse 2s ease infinite',
  },
};
