-- =============================================================
-- GeoSmart Location Intelligence System
-- File: 03_spatial_tables.sql
-- Run this THIRD (after 02_stored_procedures.sql)
-- =============================================================

-- Assign zone_id to any businesses already inserted (none yet, safe to run)
UPDATE business b
SET zone_id = (
    SELECT z.zone_id
    FROM zone z
    WHERE ST_Within(b.geom, z.geom)
    ORDER BY ST_Area(z.geom) ASC
    LIMIT 1
)
WHERE b.zone_id IS NULL;

-- =============================================================
-- Extra spatial indexes
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_business_active_geom
    ON business USING GIST (geom)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_audit_log_time
    ON business_audit_log USING BRIN (logged_at);

CREATE INDEX IF NOT EXISTS idx_snapshot_req_dist
    ON competitor_snapshot (request_id, distance_meters);

-- =============================================================
-- MATERIALIZED VIEW: business density per zone
-- =============================================================

DROP MATERIALIZED VIEW IF EXISTS zone_business_density;

CREATE MATERIALIZED VIEW zone_business_density AS
SELECT
    z.zone_id,
    z.zone_name,
    z.zone_type,
    bt.type_id,
    bt.type_name,
    COUNT(b.business_id)                                 AS business_count,
    ROUND(ST_Area(z.geom::geography)::NUMERIC / 1e6, 4) AS area_sqkm,
    ROUND(
        COUNT(b.business_id) /
        NULLIF(ST_Area(z.geom::geography) / 1e6, 0)::numeric, 4
    )                                                    AS density_per_sqkm
FROM zone z
CROSS JOIN business_type bt
LEFT JOIN business b
    ON b.type_id = bt.type_id
    AND b.is_active = TRUE
    AND ST_Within(b.geom, z.geom)
GROUP BY z.zone_id, z.zone_name, z.zone_type, z.geom, bt.type_id, bt.type_name;

CREATE UNIQUE INDEX idx_zbd_zone_type
    ON zone_business_density (zone_id, COALESCE(type_id, -1));

SELECT 'Migration 03: Spatial tables created successfully.' AS status;
