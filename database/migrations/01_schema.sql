-- =============================================================
-- GeoSmart Location Intelligence System
-- File: 01_schema.sql
-- Run this FIRST
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Drop everything cleanly if re-running
DROP TABLE IF EXISTS competitor_snapshot CASCADE;
DROP TABLE IF EXISTS recommendation CASCADE;
DROP TABLE IF EXISTS location_score CASCADE;
DROP TABLE IF EXISTS analysis_request CASCADE;
DROP TABLE IF EXISTS score_factor CASCADE;
DROP TABLE IF EXISTS business_audit_log CASCADE;
DROP TABLE IF EXISTS business CASCADE;
DROP TABLE IF EXISTS road CASCADE;
DROP TABLE IF EXISTS zone CASCADE;
DROP TABLE IF EXISTS business_type CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;

DROP TYPE IF EXISTS zone_type_enum CASCADE;
DROP TYPE IF EXISTS road_type_enum CASCADE;
DROP TYPE IF EXISTS income_level_enum CASCADE;
DROP TYPE IF EXISTS recommendation_type_enum CASCADE;

DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS set_clicked_geom() CASCADE;

-- =============================================================
-- ENUM TYPES
-- =============================================================

CREATE TYPE zone_type_enum AS ENUM (
    'residential', 'commercial', 'industrial', 'mixed', 'green'
);

CREATE TYPE road_type_enum AS ENUM (
    'motorway', 'primary', 'secondary', 'tertiary', 'residential', 'service'
);

CREATE TYPE income_level_enum AS ENUM ('low', 'medium', 'high');

CREATE TYPE recommendation_type_enum AS ENUM (
    'highly_suitable', 'suitable', 'marginal', 'not_suitable'
);

-- =============================================================
-- TABLE 1: app_user
-- =============================================================
CREATE TABLE app_user (
    user_id     SERIAL PRIMARY KEY,
    username    VARCHAR(80)  NOT NULL UNIQUE,
    email       VARCHAR(200) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ,
    CONSTRAINT chk_email_format CHECK (email LIKE '%@%')
);

-- =============================================================
-- TABLE 2: business_type
-- =============================================================
CREATE TABLE business_type (
    type_id              SERIAL PRIMARY KEY,
    type_name            VARCHAR(100) NOT NULL UNIQUE,
    display_label        VARCHAR(150) NOT NULL,
    icon_name            VARCHAR(50),
    ideal_min_distance   NUMERIC(10,2) NOT NULL DEFAULT 500
        CONSTRAINT chk_min_dist CHECK (ideal_min_distance > 0),
    max_density_per_km2  NUMERIC(6,2)  NOT NULL DEFAULT 5
        CONSTRAINT chk_max_density CHECK (max_density_per_km2 > 0),
    demand_weight        NUMERIC(4,3) NOT NULL DEFAULT 0.35
        CONSTRAINT chk_demand_w CHECK (demand_weight BETWEEN 0 AND 1),
    competition_weight   NUMERIC(4,3) NOT NULL DEFAULT 0.30
        CONSTRAINT chk_comp_w   CHECK (competition_weight BETWEEN 0 AND 1),
    road_weight          NUMERIC(4,3) NOT NULL DEFAULT 0.20
        CONSTRAINT chk_road_w   CHECK (road_weight BETWEEN 0 AND 1),
    zone_weight          NUMERIC(4,3) NOT NULL DEFAULT 0.15
        CONSTRAINT chk_zone_w   CHECK (zone_weight BETWEEN 0 AND 1),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 3: zone
-- =============================================================
CREATE TABLE zone (
    zone_id            SERIAL PRIMARY KEY,
    zone_name          VARCHAR(200) NOT NULL,
    zone_type          zone_type_enum NOT NULL DEFAULT 'mixed',
    geom               GEOMETRY(POLYGON, 4326) NOT NULL,
    population_density NUMERIC(10,2) CHECK (population_density >= 0),
    avg_income_level   income_level_enum NOT NULL DEFAULT 'medium',
    osm_id             BIGINT UNIQUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zone_geom ON zone USING GIST (geom);
CREATE INDEX idx_zone_type ON zone (zone_type);

-- =============================================================
-- TABLE 4: road
-- =============================================================
CREATE TABLE road (
    road_id      SERIAL PRIMARY KEY,
    road_name    VARCHAR(300),
    road_type    road_type_enum NOT NULL DEFAULT 'secondary',
    geom         GEOMETRY(LINESTRING, 4326) NOT NULL,
    lanes        SMALLINT CHECK (lanes > 0),
    speed_limit  SMALLINT CHECK (speed_limit > 0 AND speed_limit <= 150),
    is_one_way   BOOLEAN NOT NULL DEFAULT FALSE,
    osm_id       BIGINT UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_road_geom ON road USING GIST (geom);
CREATE INDEX idx_road_type ON road (road_type);

-- =============================================================
-- TABLE 5: business
-- =============================================================
CREATE TABLE business (
    business_id   SERIAL PRIMARY KEY,
    name          VARCHAR(300) NOT NULL,
    geom          GEOMETRY(POINT, 4326) NOT NULL,
    address       TEXT,
    type_id       INTEGER NOT NULL
        REFERENCES business_type(type_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    zone_id       INTEGER
        REFERENCES zone(zone_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    demand_score  NUMERIC(5,2) NOT NULL DEFAULT 50.0
        CONSTRAINT chk_demand_score CHECK (demand_score BETWEEN 0 AND 100),
    traffic_score NUMERIC(5,2) NOT NULL DEFAULT 50.0
        CONSTRAINT chk_traffic_score CHECK (traffic_score BETWEEN 0 AND 100),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    osm_id        BIGINT UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_geom   ON business USING GIST (geom);
CREATE INDEX idx_business_type   ON business (type_id);
CREATE INDEX idx_business_zone   ON business (zone_id);
CREATE INDEX idx_business_active ON business (is_active);

-- =============================================================
-- TABLE 6: score_factor
-- =============================================================
CREATE TABLE score_factor (
    factor_id      SERIAL PRIMARY KEY,
    factor_name    VARCHAR(100) NOT NULL UNIQUE,
    description    TEXT,
    default_weight NUMERIC(4,3) NOT NULL DEFAULT 0.25
        CONSTRAINT chk_factor_weight CHECK (default_weight BETWEEN 0 AND 1),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 7: analysis_request  (WEAK ENTITY)
-- =============================================================
CREATE TABLE analysis_request (
    request_id          SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL
        REFERENCES app_user(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    type_id             INTEGER
        REFERENCES business_type(type_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    clicked_lat         NUMERIC(10, 7) NOT NULL
        CONSTRAINT chk_lat CHECK (clicked_lat BETWEEN -90 AND 90),
    clicked_lon         NUMERIC(10, 7) NOT NULL
        CONSTRAINT chk_lon CHECK (clicked_lon BETWEEN -180 AND 180),
    clicked_geom        GEOMETRY(POINT, 4326),
    final_score         NUMERIC(5,2)
        CONSTRAINT chk_final_score CHECK (final_score BETWEEN 0 AND 100),
    competition_density NUMERIC(8,4),
    explanation_text    TEXT,
    search_radius_m     NUMERIC(8,2) NOT NULL DEFAULT 1000
        CONSTRAINT chk_radius CHECK (search_radius_m BETWEEN 100 AND 10000),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    CONSTRAINT uq_user_request UNIQUE (user_id, request_id)
);

CREATE INDEX idx_request_user ON analysis_request (user_id);
CREATE INDEX idx_request_type ON analysis_request (type_id);
CREATE INDEX idx_request_geom ON analysis_request USING GIST (clicked_geom);
CREATE INDEX idx_request_time ON analysis_request (requested_at DESC);

-- =============================================================
-- TABLE 8: location_score
-- =============================================================
CREATE TABLE location_score (
    score_id       SERIAL PRIMARY KEY,
    request_id     INTEGER NOT NULL
        REFERENCES analysis_request(request_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    factor_id      INTEGER NOT NULL
        REFERENCES score_factor(factor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    raw_value      NUMERIC(6,2) NOT NULL
        CONSTRAINT chk_raw CHECK (raw_value BETWEEN 0 AND 100),
    applied_weight NUMERIC(4,3) NOT NULL,
    weighted_score NUMERIC(6,2) GENERATED ALWAYS AS
        (ROUND(raw_value * applied_weight, 2)) STORED,
    notes          TEXT,
    CONSTRAINT uq_request_factor UNIQUE (request_id, factor_id)
);

CREATE INDEX idx_lscore_request ON location_score (request_id);
CREATE INDEX idx_lscore_factor  ON location_score (factor_id);

-- =============================================================
-- TABLE 9: recommendation
-- =============================================================
CREATE TABLE recommendation (
    rec_id              SERIAL PRIMARY KEY,
    request_id          INTEGER NOT NULL UNIQUE
        REFERENCES analysis_request(request_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    recommendation_type recommendation_type_enum NOT NULL,
    title               VARCHAR(300) NOT NULL,
    body_text           TEXT NOT NULL,
    pros_list           TEXT[],
    cons_list           TEXT[],
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rec_request ON recommendation (request_id);
CREATE INDEX idx_rec_type    ON recommendation (recommendation_type);

-- =============================================================
-- TABLE 10: competitor_snapshot
-- =============================================================
CREATE TABLE competitor_snapshot (
    snapshot_id      SERIAL PRIMARY KEY,
    request_id       INTEGER NOT NULL
        REFERENCES analysis_request(request_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    business_id      INTEGER NOT NULL
        REFERENCES business(business_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    distance_meters  NUMERIC(10,2) NOT NULL
        CONSTRAINT chk_distance CHECK (distance_meters >= 0),
    captured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_snapshot UNIQUE (request_id, business_id)
);

CREATE INDEX idx_snapshot_request  ON competitor_snapshot (request_id);
CREATE INDEX idx_snapshot_business ON competitor_snapshot (business_id);
CREATE INDEX idx_snapshot_distance ON competitor_snapshot (distance_meters);

-- =============================================================
-- AUDIT LOG
-- =============================================================
CREATE TABLE business_audit_log (
    log_id       SERIAL PRIMARY KEY,
    event_type   VARCHAR(20) NOT NULL,
    business_id  INTEGER,
    type_id      INTEGER,
    geom         GEOMETRY(POINT, 4326),
    message      TEXT,
    logged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- VIEWS
-- =============================================================
CREATE OR REPLACE VIEW zone_with_area AS
SELECT
    z.*,
    ROUND((ST_Area(z.geom::geography) / 1e6)::NUMERIC, 4) AS area_sqkm
FROM zone z;

-- =============================================================
-- HELPER TRIGGER FUNCTIONS
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_updated_at
BEFORE UPDATE ON business
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION set_clicked_geom()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.clicked_geom = ST_SetSRID(
        ST_MakePoint(NEW.clicked_lon, NEW.clicked_lat), 4326
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_clicked_geom
BEFORE INSERT OR UPDATE ON analysis_request
FOR EACH ROW EXECUTE FUNCTION set_clicked_geom();

SELECT 'Migration 01: Schema created successfully.' AS status;
