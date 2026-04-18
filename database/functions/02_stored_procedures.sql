-- =============================================================
-- GeoSmart Location Intelligence System
-- File: 02_stored_procedures.sql
-- Run this SECOND
-- =============================================================

DROP FUNCTION IF EXISTS analyze_location(NUMERIC,NUMERIC,INTEGER,NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS find_best_locations(INTEGER,GEOMETRY,INTEGER,NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS get_top_ranked_locations(INTEGER,INTEGER) CASCADE;
DROP FUNCTION IF EXISTS find_low_competition_zones(INTEGER,NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS compare_two_locations(NUMERIC,NUMERIC,NUMERIC,NUMERIC,INTEGER,NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS get_underserved_areas(INTEGER,NUMERIC,INTEGER) CASCADE;
DROP FUNCTION IF EXISTS generate_explanation(JSONB,VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS save_analysis_request(INTEGER,INTEGER,NUMERIC,NUMERIC,NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS refresh_zone_density() CASCADE;

-- =============================================================
-- FUNCTION 1: analyze_location
-- =============================================================
CREATE OR REPLACE FUNCTION analyze_location(
    p_lat       NUMERIC,
    p_lon       NUMERIC,
    p_type_id   INTEGER,
    p_radius_m  NUMERIC DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_point              GEOMETRY;
    v_type               RECORD;
    v_comp_count         INTEGER;
    v_comp_density       NUMERIC;
    v_competition_score  NUMERIC;
    v_demand_score       NUMERIC;
    v_road_score         NUMERIC;
    v_zone_score         NUMERIC;
    v_zone_type          TEXT;
    v_zone_pop           NUMERIC;
    v_zone_income        TEXT;
    v_road_count         INTEGER;
    v_primary_roads      INTEGER;
    v_final_score        NUMERIC;
    v_radius_km2         NUMERIC;
    v_result             JSONB;
BEGIN
    v_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);

    SELECT * INTO v_type FROM business_type WHERE type_id = p_type_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Business type % not found', p_type_id;
    END IF;

    -- Competition Score
    SELECT COUNT(*) INTO v_comp_count
    FROM business b
    WHERE b.type_id = p_type_id
      AND b.is_active = TRUE
      AND ST_DWithin(b.geom::geography, v_point::geography, p_radius_m);

    v_radius_km2 := PI() * POWER(p_radius_m / 1000.0, 2);
    v_comp_density := v_comp_count / NULLIF(v_radius_km2, 0);

    v_competition_score := GREATEST(0, LEAST(100,
        100 - (v_comp_density / NULLIF(v_type.max_density_per_km2, 0)) * 100
    ));

    -- Demand Score
    SELECT COALESCE(
        AVG(b.demand_score) * 0.6 + COALESCE(AVG(z.population_density) / 200.0, 50) * 0.4,
        50
    )
    INTO v_demand_score
    FROM business b
    LEFT JOIN zone z ON ST_Within(b.geom, z.geom)
    WHERE ST_DWithin(b.geom::geography, v_point::geography, p_radius_m);

    v_demand_score := LEAST(100, GREATEST(0, COALESCE(v_demand_score, 50)));

    -- Road Score
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE road_type IN ('primary','secondary','motorway'))
    INTO v_road_count, v_primary_roads
    FROM road
    WHERE ST_DWithin(geom::geography, v_point::geography, 200);

    v_road_score := LEAST(100, (COALESCE(v_road_count,0) * 10) + (COALESCE(v_primary_roads,0) * 15));

    -- Zone Score
    SELECT z.zone_type::TEXT, z.population_density, z.avg_income_level::TEXT
    INTO v_zone_type, v_zone_pop, v_zone_income
    FROM zone z
    WHERE ST_Within(v_point, z.geom)
    ORDER BY ST_Area(z.geom) ASC
    LIMIT 1;

    IF v_zone_type IS NULL THEN
        v_zone_score := 40;
    ELSE
        v_zone_score := CASE
            WHEN v_type.type_name IN ('cafe','restaurant','supermarket','bank','gym') THEN
                CASE v_zone_type
                    WHEN 'commercial'  THEN 95
                    WHEN 'mixed'       THEN 75
                    WHEN 'residential' THEN 60
                    WHEN 'industrial'  THEN 25
                    WHEN 'green'       THEN 30
                    ELSE 50
                END
            WHEN v_type.type_name IN ('hospital','pharmacy','school') THEN
                CASE v_zone_type
                    WHEN 'residential' THEN 90
                    WHEN 'mixed'       THEN 75
                    WHEN 'commercial'  THEN 65
                    WHEN 'industrial'  THEN 20
                    WHEN 'green'       THEN 40
                    ELSE 50
                END
            WHEN v_type.type_name IN ('fuel_station','ev_station') THEN
                CASE v_zone_type
                    WHEN 'commercial'  THEN 80
                    WHEN 'mixed'       THEN 70
                    WHEN 'residential' THEN 50
                    WHEN 'industrial'  THEN 60
                    WHEN 'green'       THEN 10
                    ELSE 50
                END
            ELSE
                CASE v_zone_type
                    WHEN 'commercial'  THEN 80
                    WHEN 'mixed'       THEN 70
                    WHEN 'residential' THEN 55
                    ELSE 40
                END
        END;
    END IF;

    -- Final weighted score
    v_final_score := ROUND((
        v_competition_score * v_type.competition_weight +
        v_demand_score      * v_type.demand_weight +
        v_road_score        * v_type.road_weight +
        v_zone_score        * v_type.zone_weight
    )::NUMERIC, 2);

    v_result := jsonb_build_object(
        'final_score',         v_final_score,
        'competition_density', ROUND(COALESCE(v_comp_density,0)::NUMERIC, 4),
        'competitor_count',    COALESCE(v_comp_count, 0),
        'scores', jsonb_build_object(
            'competition', ROUND(v_competition_score::NUMERIC, 2),
            'demand',      ROUND(v_demand_score::NUMERIC, 2),
            'road_access', ROUND(v_road_score::NUMERIC, 2),
            'zone_fit',    ROUND(v_zone_score::NUMERIC, 2)
        ),
        'weights', jsonb_build_object(
            'competition', v_type.competition_weight,
            'demand',      v_type.demand_weight,
            'road_access', v_type.road_weight,
            'zone_fit',    v_type.zone_weight
        ),
        'zone', CASE WHEN v_zone_type IS NULL THEN 'null'::jsonb
                     ELSE jsonb_build_object(
                         'type',        v_zone_type,
                         'income_level',COALESCE(v_zone_income, 'medium'),
                         'pop_density', COALESCE(v_zone_pop, 0)
                     )
                END,
        'road_count',    COALESCE(v_road_count, 0),
        'primary_roads', COALESCE(v_primary_roads, 0)
    );

    RETURN v_result;
END;
$$;

-- =============================================================
-- FUNCTION 2: refresh_zone_density
-- Must exist before 03_spatial_tables.sql runs
-- =============================================================
CREATE OR REPLACE FUNCTION refresh_zone_density()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_matviews WHERE matviewname = 'zone_business_density'
    ) THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY zone_business_density;
    END IF;
END;
$$;

-- =============================================================
-- FUNCTION 3: get_top_ranked_locations
-- =============================================================
CREATE OR REPLACE FUNCTION get_top_ranked_locations(
    p_type_id INTEGER DEFAULT NULL,
    p_limit   INTEGER DEFAULT 10
)
RETURNS TABLE (
    rank            BIGINT,
    business_id     INTEGER,
    business_name   VARCHAR,
    type_name       VARCHAR,
    zone_type       TEXT,
    demand_score    NUMERIC,
    traffic_score   NUMERIC,
    composite_score NUMERIC,
    road_count      BIGINT,
    ntile_quartile  INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH road_access AS (
        SELECT b.business_id, COUNT(r.road_id) AS nearby_roads
        FROM business b
        LEFT JOIN road r ON ST_DWithin(r.geom::geography, b.geom::geography, 200)
        GROUP BY b.business_id
    ),
    scored AS (
        SELECT
            b.business_id,
            b.name::VARCHAR                         AS business_name,
            bt.type_name::VARCHAR,
            COALESCE(z.zone_type::TEXT, 'unknown')  AS zone_type,
            b.demand_score,
            b.traffic_score,
            ROUND((
                b.demand_score  * bt.demand_weight +
                b.traffic_score * bt.road_weight +
                CASE COALESCE(z.zone_type::TEXT, 'mixed')
                    WHEN 'commercial'  THEN 90
                    WHEN 'mixed'       THEN 70
                    WHEN 'residential' THEN 55
                    ELSE 40
                END * bt.zone_weight
            )::NUMERIC, 2)                          AS composite_score,
            COALESCE(ra.nearby_roads, 0)            AS road_count
        FROM business b
        JOIN business_type bt ON b.type_id = bt.type_id
        LEFT JOIN zone z ON b.zone_id = z.zone_id
        LEFT JOIN road_access ra ON b.business_id = ra.business_id
        WHERE b.is_active = TRUE
          AND (p_type_id IS NULL OR b.type_id = p_type_id)
    )
    SELECT
        RANK() OVER (ORDER BY s.composite_score DESC),
        s.business_id,
        s.business_name,
        s.type_name,
        s.zone_type,
        s.demand_score,
        s.traffic_score,
        s.composite_score,
        s.road_count,
        NTILE(4) OVER (ORDER BY s.composite_score DESC)
    FROM scored s
    ORDER BY s.composite_score DESC
    LIMIT p_limit;
END;
$$;

-- =============================================================
-- FUNCTION 4: find_low_competition_zones
-- =============================================================
CREATE OR REPLACE FUNCTION find_low_competition_zones(
    p_type_id     INTEGER,
    p_max_density NUMERIC DEFAULT 2.0
)
RETURNS TABLE (
    zone_id            INTEGER,
    zone_name          VARCHAR,
    zone_type          TEXT,
    area_sqkm          NUMERIC,
    business_count     BIGINT,
    density_per_sqkm   NUMERIC,
    population_density NUMERIC,
    opportunity_score  NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH zone_stats AS (
        SELECT
            z.zone_id,
            z.zone_name::VARCHAR,
            z.zone_type::TEXT,
            ROUND(ST_Area(z.geom::geography)::NUMERIC / 1e6, 4) AS area_sqkm,
            COUNT(b.business_id)                                  AS business_count,
            z.population_density
        FROM zone z
        LEFT JOIN business b
            ON b.type_id = p_type_id
            AND b.is_active = TRUE
            AND ST_Within(b.geom, z.geom)
        GROUP BY z.zone_id, z.zone_name, z.zone_type, z.geom, z.population_density
    )
    SELECT
        zs.zone_id,
        zs.zone_name,
        zs.zone_type,
        zs.area_sqkm,
        zs.business_count,
        ROUND(zs.business_count / NULLIF(zs.area_sqkm, 0), 4) AS density_per_sqkm,
        COALESCE(zs.population_density, 0),
        ROUND(
            LEAST(100, COALESCE(zs.population_density, 5000) / 200.0) *
            (1 - LEAST(1.0, (zs.business_count::NUMERIC / NULLIF(zs.area_sqkm, 0)) / p_max_density))
        , 2) AS opportunity_score
    FROM zone_stats zs
    WHERE (zs.business_count::NUMERIC / NULLIF(zs.area_sqkm, 0)) < p_max_density
       OR zs.business_count = 0
    ORDER BY opportunity_score DESC;
END;
$$;

-- =============================================================
-- FUNCTION 5: compare_two_locations
-- =============================================================
CREATE OR REPLACE FUNCTION compare_two_locations(
    p_lat1     NUMERIC, p_lon1 NUMERIC,
    p_lat2     NUMERIC, p_lon2 NUMERIC,
    p_type_id  INTEGER,
    p_radius_m NUMERIC DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_analysis1 JSONB;
    v_analysis2 JSONB;
    v_point1    GEOMETRY;
    v_point2    GEOMETRY;
    v_distance  NUMERIC;
    v_winner    INTEGER;
BEGIN
    v_analysis1 := analyze_location(p_lat1, p_lon1, p_type_id, p_radius_m);
    v_analysis2 := analyze_location(p_lat2, p_lon2, p_type_id, p_radius_m);

    v_point1 := ST_SetSRID(ST_MakePoint(p_lon1, p_lat1), 4326);
    v_point2 := ST_SetSRID(ST_MakePoint(p_lon2, p_lat2), 4326);
    v_distance := ST_Distance(v_point1::geography, v_point2::geography);

    v_winner := CASE
        WHEN (v_analysis1->>'final_score')::NUMERIC > (v_analysis2->>'final_score')::NUMERIC THEN 1
        WHEN (v_analysis2->>'final_score')::NUMERIC > (v_analysis1->>'final_score')::NUMERIC THEN 2
        ELSE 0
    END;

    RETURN jsonb_build_object(
        'location_1', jsonb_build_object('lat', p_lat1, 'lon', p_lon1, 'analysis', v_analysis1),
        'location_2', jsonb_build_object('lat', p_lat2, 'lon', p_lon2, 'analysis', v_analysis2),
        'distance_between_m', ROUND(v_distance::NUMERIC, 2),
        'winner_location',    v_winner,
        'score_difference',   ROUND(ABS(
            (v_analysis1->>'final_score')::NUMERIC -
            (v_analysis2->>'final_score')::NUMERIC
        )::NUMERIC, 2)
    );
END;
$$;

-- =============================================================
-- FUNCTION 6: get_underserved_areas
-- =============================================================
CREATE OR REPLACE FUNCTION get_underserved_areas(
    p_type_id         INTEGER,
    p_min_population  NUMERIC DEFAULT 3000,
    p_max_businesses  INTEGER DEFAULT 2
)
RETURNS TABLE (
    zone_id            INTEGER,
    zone_name          VARCHAR,
    zone_type          TEXT,
    population_density NUMERIC,
    business_count     BIGINT,
    centroid_lat       NUMERIC,
    centroid_lon       NUMERIC,
    underserved_score  NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        z.zone_id,
        z.zone_name::VARCHAR,
        z.zone_type::TEXT,
        COALESCE(z.population_density, 0),
        COUNT(b.business_id)                              AS business_count,
        ROUND(ST_Y(ST_Centroid(z.geom))::NUMERIC, 6)     AS centroid_lat,
        ROUND(ST_X(ST_Centroid(z.geom))::NUMERIC, 6)     AS centroid_lon,
        ROUND(
            LEAST(100,
                COALESCE(z.population_density, 0) / 200.0 *
                GREATEST(0, 1 - COUNT(b.business_id)::NUMERIC / (p_max_businesses + 1))
            )::NUMERIC, 2
        )                                                 AS underserved_score
    FROM zone z
    LEFT JOIN business b
        ON b.type_id = p_type_id
        AND b.is_active = TRUE
        AND ST_Within(b.geom, z.geom)
    WHERE COALESCE(z.population_density, 0) >= p_min_population
    GROUP BY z.zone_id, z.zone_name, z.zone_type, z.geom, z.population_density
    HAVING COUNT(b.business_id) <= p_max_businesses
    ORDER BY underserved_score DESC;
END;
$$;

-- =============================================================
-- FUNCTION 7: generate_explanation
-- =============================================================
CREATE OR REPLACE FUNCTION generate_explanation(
    p_analysis  JSONB,
    p_type_name VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_final    NUMERIC;
    v_comp     NUMERIC;
    v_demand   NUMERIC;
    v_road     NUMERIC;
    v_zone     NUMERIC;
    v_rec_type TEXT;
    v_title    TEXT;
    v_body     TEXT;
    v_pros     TEXT[] := ARRAY[]::TEXT[];
    v_cons     TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_final  := COALESCE((p_analysis->>'final_score')::NUMERIC, 0);
    v_comp   := COALESCE((p_analysis->'scores'->>'competition')::NUMERIC, 0);
    v_demand := COALESCE((p_analysis->'scores'->>'demand')::NUMERIC, 0);
    v_road   := COALESCE((p_analysis->'scores'->>'road_access')::NUMERIC, 0);
    v_zone   := COALESCE((p_analysis->'scores'->>'zone_fit')::NUMERIC, 0);

    v_rec_type := CASE
        WHEN v_final >= 75 THEN 'highly_suitable'
        WHEN v_final >= 55 THEN 'suitable'
        WHEN v_final >= 35 THEN 'marginal'
        ELSE 'not_suitable'
    END;

    v_title := CASE v_rec_type
        WHEN 'highly_suitable' THEN 'Excellent Location for ' || p_type_name
        WHEN 'suitable'        THEN 'Good Location for '      || p_type_name
        WHEN 'marginal'        THEN 'Moderate Suitability for '|| p_type_name
        ELSE                        'Not Recommended for '    || p_type_name
    END;

    IF v_comp   >= 70 THEN v_pros := array_append(v_pros, 'Low competition — market gap available'); END IF;
    IF v_comp   BETWEEN 50 AND 69 THEN v_pros := array_append(v_pros, 'Moderate competition with room to differentiate'); END IF;
    IF v_demand >= 65 THEN v_pros := array_append(v_pros, 'High demand in the surrounding area'); END IF;
    IF v_road   >= 60 THEN v_pros := array_append(v_pros, 'Strong road connectivity and accessibility'); END IF;
    IF v_zone   >= 70 THEN v_pros := array_append(v_pros, 'Zone type is well-suited for this business'); END IF;

    IF v_comp   < 40 THEN v_cons := array_append(v_cons, 'High competition density — market may be saturated'); END IF;
    IF v_demand < 40 THEN v_cons := array_append(v_cons, 'Lower demand signals in the area'); END IF;
    IF v_road   < 30 THEN v_cons := array_append(v_cons, 'Limited road access — may affect customer footfall'); END IF;
    IF v_zone   < 40 THEN v_cons := array_append(v_cons, 'Zone type is not optimal for this business category'); END IF;

    v_body := CASE
        WHEN v_final >= 75 THEN 'This location offers exceptional conditions for a ' || p_type_name || '. '
        WHEN v_final >= 55 THEN 'This is a reasonably good spot for a ' || p_type_name || '. '
        WHEN v_final >= 35 THEN 'This location has mixed signals for a ' || p_type_name || '. '
        ELSE 'This location presents significant challenges for a ' || p_type_name || '. '
    END;

    v_body := v_body || CASE
        WHEN v_comp >= 70 AND v_demand >= 65 THEN
            'High demand, low competition, and strong road connectivity make this a highly suitable location. '
        WHEN v_comp < 40 AND v_demand >= 65 THEN
            'Despite strong demand, high competition density suggests the market may be crowded. '
        WHEN v_comp >= 70 AND v_demand < 40 THEN
            'While competition is low, demand signals are weak — investigate area footfall. '
        WHEN v_road < 30 THEN
            'Road accessibility is a concern; poor connectivity may limit customer reach. '
        ELSE 'Review individual factor scores for detailed insight. '
    END;

    v_body := v_body || format(
        'Nearby competitors: %s. Road connections within 200m: %s.',
        COALESCE(p_analysis->>'competitor_count', '0'),
        COALESCE(p_analysis->>'road_count', '0')
    );

    RETURN jsonb_build_object(
        'recommendation_type', v_rec_type,
        'title',               v_title,
        'body',                v_body,
        'pros',                to_jsonb(v_pros),
        'cons',                to_jsonb(v_cons)
    );
END;
$$;

-- =============================================================
-- FUNCTION 8: save_analysis_request  (full transaction)
-- =============================================================
CREATE OR REPLACE FUNCTION save_analysis_request(
    p_user_id    INTEGER,
    p_type_id    INTEGER,
    p_lat        NUMERIC,
    p_lon        NUMERIC,
    p_radius_m   NUMERIC DEFAULT 1000
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_request_id  INTEGER;
    v_analysis    JSONB;
    v_explanation JSONB;
    v_type_name   VARCHAR;
    v_factor      RECORD;
    v_competitor  RECORD;
BEGIN
    v_analysis := analyze_location(p_lat, p_lon, p_type_id, p_radius_m);

    SELECT display_label INTO v_type_name FROM business_type WHERE type_id = p_type_id;
    v_explanation := generate_explanation(v_analysis, v_type_name);

    INSERT INTO analysis_request (
        user_id, type_id, clicked_lat, clicked_lon,
        final_score, competition_density, explanation_text,
        search_radius_m, completed_at
    ) VALUES (
        p_user_id, p_type_id, p_lat, p_lon,
        (v_analysis->>'final_score')::NUMERIC,
        (v_analysis->>'competition_density')::NUMERIC,
        v_explanation->>'body',
        p_radius_m, NOW()
    )
    RETURNING request_id INTO v_request_id;

    -- Insert per-factor scores
    FOR v_factor IN SELECT * FROM score_factor LOOP
        INSERT INTO location_score (request_id, factor_id, raw_value, applied_weight)
        SELECT
            v_request_id,
            v_factor.factor_id,
            CASE v_factor.factor_name
                WHEN 'competition' THEN (v_analysis->'scores'->>'competition')::NUMERIC
                WHEN 'demand'      THEN (v_analysis->'scores'->>'demand')::NUMERIC
                WHEN 'road_access' THEN (v_analysis->'scores'->>'road_access')::NUMERIC
                WHEN 'zone_fit'    THEN (v_analysis->'scores'->>'zone_fit')::NUMERIC
                ELSE 0
            END,
            v_factor.default_weight
        ON CONFLICT (request_id, factor_id) DO NOTHING;
    END LOOP;

    -- Insert recommendation
    INSERT INTO recommendation (
        request_id, recommendation_type, title, body_text, pros_list, cons_list
    ) VALUES (
        v_request_id,
        (v_explanation->>'recommendation_type')::recommendation_type_enum,
        v_explanation->>'title',
        v_explanation->>'body',
        ARRAY(SELECT jsonb_array_elements_text(v_explanation->'pros')),
        ARRAY(SELECT jsonb_array_elements_text(v_explanation->'cons'))
    );

    -- Snapshot nearby competitors
    FOR v_competitor IN
        SELECT
            b.business_id,
            ST_Distance(
                b.geom::geography,
                ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
            ) AS dist_m
        FROM business b
        WHERE b.type_id = p_type_id
          AND b.is_active = TRUE
          AND ST_DWithin(
              b.geom::geography,
              ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
              p_radius_m
          )
    LOOP
        INSERT INTO competitor_snapshot (request_id, business_id, distance_meters)
        VALUES (v_request_id, v_competitor.business_id, ROUND(v_competitor.dist_m::NUMERIC, 2))
        ON CONFLICT (request_id, business_id) DO NOTHING;
    END LOOP;

    RETURN v_request_id;
END;
$$;

-- =============================================================
-- FUNCTION: find_best_locations
-- =============================================================
CREATE OR REPLACE FUNCTION find_best_locations(
    p_type_id   INTEGER,
    p_lat       NUMERIC,
    p_lon       NUMERIC,
    p_radius_m  NUMERIC DEFAULT 1000
)
RETURNS TABLE (
    zone_id            INTEGER,
    zone_name          VARCHAR,
    zone_type          TEXT,
    centroid_lat       NUMERIC,
    centroid_lon       NUMERIC,
    business_count     BIGINT,
    population_density NUMERIC,
    competition_score  NUMERIC,
    demand_score       NUMERIC,
    final_score        NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_point GEOMETRY;
BEGIN
    -- Create reference point
    v_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);

    RETURN QUERY
    WITH zone_candidates AS (
        SELECT
            z.zone_id,
            z.zone_name::VARCHAR,
            z.zone_type::TEXT,
            z.population_density,
            ST_Centroid(z.geom) AS centroid_geom
        FROM zone z
        WHERE ST_DWithin(z.geom::geography, v_point::geography, p_radius_m)
    ),

    business_stats AS (
        SELECT
            zc.zone_id,
            COUNT(b.business_id) AS business_count
        FROM zone_candidates zc
        LEFT JOIN business b
            ON b.type_id = p_type_id
            AND b.is_active = TRUE
            AND ST_Within(b.geom, zc.centroid_geom)
        GROUP BY zc.zone_id
    ),

    scored AS (
        SELECT
            zc.zone_id,
            zc.zone_name,
            zc.zone_type,
            ROUND(ST_Y(zc.centroid_geom)::NUMERIC, 6) AS centroid_lat,
            ROUND(ST_X(zc.centroid_geom)::NUMERIC, 6) AS centroid_lon,
            COALESCE(bs.business_count, 0) AS business_count,
            COALESCE(zc.population_density, 0) AS population_density,

            -- Competition score (less businesses = better)
            ROUND(
                GREATEST(0, 100 - COALESCE(bs.business_count, 0) * 15)::NUMERIC,
            2) AS competition_score,

            -- Demand score (based on population)
            ROUND(
                LEAST(100, COALESCE(zc.population_density, 0) / 200.0)::NUMERIC,
            2) AS demand_score

        FROM zone_candidates zc
        LEFT JOIN business_stats bs ON zc.zone_id = bs.zone_id
    )

    SELECT
        s.zone_id,
        s.zone_name,
        s.zone_type,
        s.centroid_lat,
        s.centroid_lon,
        s.business_count,
        s.population_density,
        s.competition_score,
        s.demand_score,

        -- Final score (weighted)
        ROUND((
            s.competition_score * 0.6 +
            s.demand_score      * 0.4
        )::NUMERIC, 2) AS final_score

    FROM scored s
    ORDER BY final_score DESC
    LIMIT 10;

END;
$$;

SELECT 'Migration 02: Stored procedures created successfully.' AS status;
