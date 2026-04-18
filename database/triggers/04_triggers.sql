-- =============================================================
-- GeoSmart Location Intelligence System
-- File: 04_triggers.sql
-- Run this FOURTH
-- =============================================================

DROP FUNCTION IF EXISTS prevent_business_oversaturation() CASCADE;
DROP FUNCTION IF EXISTS recalculate_nearby_scores() CASCADE;
DROP FUNCTION IF EXISTS recalculate_on_deactivation() CASCADE;
DROP FUNCTION IF EXISTS enforce_weight_sum() CASCADE;

-- =============================================================
-- TRIGGER 1: prevent_business_oversaturation
-- Blocks INSERT if too many same-type businesses exist nearby
-- =============================================================

CREATE OR REPLACE FUNCTION prevent_business_oversaturation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_type         RECORD;
    v_nearby_count INTEGER;
    v_radius       NUMERIC;
    v_max_allowed  INTEGER;
BEGIN
    SELECT * INTO v_type FROM business_type WHERE type_id = NEW.type_id;

    v_radius      := v_type.ideal_min_distance;
    v_max_allowed := GREATEST(
        CEIL(v_type.max_density_per_km2 * PI() * POWER(v_radius / 1000.0, 2))::INTEGER,
        1
    );

    SELECT COUNT(*) INTO v_nearby_count
    FROM business
    WHERE type_id   = NEW.type_id
      AND is_active = TRUE
      AND business_id != COALESCE(NEW.business_id, -1)
      AND ST_DWithin(geom::geography, NEW.geom::geography, v_radius);

    IF v_nearby_count >= v_max_allowed THEN
        INSERT INTO business_audit_log (event_type, type_id, geom, message)
        VALUES (
            'BLOCKED', NEW.type_id, NEW.geom,
            format('Blocked: %s similar businesses within %.0fm (max %s). Type: %s',
                   v_nearby_count, v_radius, v_max_allowed, v_type.type_name)
        );
        RAISE EXCEPTION
            'Cannot add business: % of type "%" already exist within %.0f meters (max: %). Choose a different location.',
            v_nearby_count, v_type.type_name, v_radius, v_max_allowed
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO business_audit_log (event_type, type_id, geom, message)
    VALUES (
        'INSERT', NEW.type_id, NEW.geom,
        format('Allowed: %s/%s similar businesses nearby. Type: %s',
               v_nearby_count, v_max_allowed, v_type.type_name)
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_oversaturation
BEFORE INSERT ON business
FOR EACH ROW EXECUTE FUNCTION prevent_business_oversaturation();

-- =============================================================
-- TRIGGER 2: recalculate_nearby_scores
-- After INSERT/DELETE on business, update cached scores for
-- any analysis_request whose search area overlaps
-- =============================================================

CREATE OR REPLACE FUNCTION recalculate_nearby_scores()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_radius    NUMERIC;
    v_type_name VARCHAR;
    v_affected_geom GEOMETRY;
    v_affected_type INTEGER;
    v_req       RECORD;
    v_new_analysis JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_affected_geom := OLD.geom;
        v_affected_type := OLD.type_id;
    ELSE
        v_affected_geom := NEW.geom;
        v_affected_type := NEW.type_id;
    END IF;

    SELECT bt.ideal_min_distance, bt.type_name
    INTO v_radius, v_type_name
    FROM business_type bt WHERE bt.type_id = v_affected_type;

    -- Update cached scores for affected analysis requests
    FOR v_req IN
        SELECT ar.request_id, ar.clicked_lat, ar.clicked_lon,
               ar.type_id, ar.search_radius_m
        FROM analysis_request ar
        WHERE ar.type_id = v_affected_type
          AND ar.clicked_geom IS NOT NULL
          AND ST_DWithin(
              ar.clicked_geom::geography,
              v_affected_geom::geography,
              GREATEST(v_radius, 1000)
          )
    LOOP
        v_new_analysis := analyze_location(
            v_req.clicked_lat, v_req.clicked_lon,
            v_req.type_id, v_req.search_radius_m
        );

        UPDATE analysis_request
        SET final_score         = (v_new_analysis->>'final_score')::NUMERIC,
            competition_density = (v_new_analysis->>'competition_density')::NUMERIC,
            completed_at        = NOW()
        WHERE request_id = v_req.request_id;
    END LOOP;

    -- Refresh materialized view
    PERFORM refresh_zone_density();

    INSERT INTO business_audit_log (event_type, business_id, type_id, geom, message)
    VALUES (
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.business_id ELSE NEW.business_id END,
        v_affected_type,
        v_affected_geom,
        format('Score recalc triggered by %s on type %s', TG_OP, v_type_name)
    );

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalculate_scores
AFTER INSERT OR DELETE ON business
FOR EACH ROW EXECUTE FUNCTION recalculate_nearby_scores();

-- Fire on soft-delete (is_active toggled to FALSE)
CREATE TRIGGER trg_recalc_on_deactivate
AFTER UPDATE OF is_active ON business
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION recalculate_nearby_scores();

-- =============================================================
-- TRIGGER 3: enforce_weight_sum
-- =============================================================

CREATE OR REPLACE FUNCTION enforce_weight_sum()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    v_total := NEW.demand_weight + NEW.competition_weight +
               NEW.road_weight  + NEW.zone_weight;
    IF ABS(v_total - 1.0) > 0.01 THEN
        RAISE EXCEPTION
            'Weights must sum to 1.0 (±0.01). Current sum: %.3f', v_total
            USING ERRCODE = 'P0002';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_weight_sum
BEFORE INSERT OR UPDATE ON business_type
FOR EACH ROW EXECUTE FUNCTION enforce_weight_sum();

SELECT 'Migration 04: Triggers created successfully.' AS status;
