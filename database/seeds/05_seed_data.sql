-- =============================================================
-- GeoSmart Location Intelligence System
-- File: 05_seed_data.sql
-- Run this FIFTH (last)
-- =============================================================

-- =============================================================
-- 1. Users
-- =============================================================
INSERT INTO app_user (username, email) VALUES
    ('admin',      'admin@geosmart.io'),
    ('analyst_01', 'analyst01@geosmart.io'),
    ('demo_user',  'demo@geosmart.io')
ON CONFLICT DO NOTHING;

-- =============================================================
-- 2. Business types
-- Weights for each row must sum to exactly 1.0
-- =============================================================

-- Temporarily disable weight-sum trigger so we can bulk insert
ALTER TABLE business_type DISABLE TRIGGER trg_enforce_weight_sum;

INSERT INTO business_type
    (type_name, display_label, icon_name,
     ideal_min_distance, max_density_per_km2,
     demand_weight, competition_weight, road_weight, zone_weight)
VALUES
    ('cafe',        'Café / Coffee Shop',    'coffee',        400,  8, 0.35, 0.30, 0.20, 0.15),
    ('restaurant',  'Restaurant',            'utensils',      350, 10, 0.35, 0.25, 0.20, 0.20),
    ('hospital',    'Hospital / Clinic',     'cross',        1500,  2, 0.30, 0.35, 0.15, 0.20),
    ('pharmacy',    'Pharmacy',              'pill',          600,  5, 0.30, 0.30, 0.20, 0.20),
    ('ev_station',  'EV Charging Station',   'zap',           800,  3, 0.25, 0.35, 0.25, 0.15),
    ('fuel_station','Fuel / Petrol Station', 'droplet',      1000,  3, 0.25, 0.35, 0.25, 0.15),
    ('school',      'School / Institute',    'book',         1200,  3, 0.30, 0.35, 0.15, 0.20),
    ('supermarket', 'Supermarket / Grocery', 'shopping-cart', 700,  4, 0.35, 0.25, 0.20, 0.20),
    ('bank',        'Bank / ATM',            'landmark',      500,  6, 0.30, 0.25, 0.25, 0.20),
    ('gym',         'Gym / Fitness Center',  'dumbbell',      600,  5, 0.35, 0.25, 0.25, 0.15)
ON CONFLICT (type_name) DO NOTHING;

ALTER TABLE business_type ENABLE TRIGGER trg_enforce_weight_sum;

-- =============================================================
-- 3. Score factors
-- =============================================================
INSERT INTO score_factor (factor_name, description, default_weight) VALUES
    ('competition', 'Inverse of nearby competitor density',      0.30),
    ('demand',      'Estimated footfall and demand in the area', 0.35),
    ('road_access', 'Number and quality of roads within 200m',   0.20),
    ('zone_fit',    'Suitability of the surrounding zone type',  0.15)
ON CONFLICT (factor_name) DO NOTHING;

-- =============================================================
-- 4. Zones (Coimbatore, Tamil Nadu)
-- =============================================================
INSERT INTO zone (zone_name, zone_type, geom, population_density, avg_income_level) VALUES
('RS Puram Commercial Hub',
 'commercial',
 ST_GeomFromText('POLYGON((76.955 11.003, 76.975 11.003, 76.975 11.015, 76.955 11.015, 76.955 11.003))', 4326),
 8500, 'high'),

('Gandhipuram Central',
 'commercial',
 ST_GeomFromText('POLYGON((76.960 11.015, 76.985 11.015, 76.985 11.030, 76.960 11.030, 76.960 11.015))', 4326),
 12000, 'medium'),

('Peelamedu Residential',
 'residential',
 ST_GeomFromText('POLYGON((77.000 11.020, 77.025 11.020, 77.025 11.040, 77.000 11.040, 77.000 11.020))', 4326),
 9000, 'medium'),

('Saravanampatti Tech Zone',
 'mixed',
 ST_GeomFromText('POLYGON((77.025 11.055, 77.065 11.055, 77.065 11.080, 77.025 11.080, 77.025 11.055))', 4326),
 6000, 'high'),

('Singanallur Industrial',
 'industrial',
 ST_GeomFromText('POLYGON((77.005 10.995, 77.035 10.995, 77.035 11.015, 77.005 11.015, 77.005 10.995))', 4326),
 2500, 'low'),

('Ukkadam Mixed Zone',
 'mixed',
 ST_GeomFromText('POLYGON((76.965 10.985, 76.990 10.985, 76.990 11.005, 76.965 11.005, 76.965 10.985))', 4326),
 7000, 'medium'),

('Coimbatore Airport Area',
 'mixed',
 ST_GeomFromText('POLYGON((77.035 11.015, 77.060 11.015, 77.060 11.035, 77.035 11.035, 77.035 11.015))', 4326),
 3500, 'medium'),

('Race Course Residential',
 'residential',
 ST_GeomFromText('POLYGON((76.940 11.005, 76.960 11.005, 76.960 11.020, 76.940 11.020, 76.940 11.005))', 4326),
 10500, 'high'),

('Ganapathy Residential',
 'residential',
 ST_GeomFromText('POLYGON((76.930 11.020, 76.955 11.020, 76.955 11.040, 76.930 11.040, 76.930 11.020))', 4326),
 11000, 'medium'),

('Tidel Park Commercial',
 'commercial',
 ST_GeomFromText('POLYGON((77.050 11.040, 77.080 11.040, 77.080 11.060, 77.050 11.060, 77.050 11.040))', 4326),
 5000, 'high')
ON CONFLICT DO NOTHING;

-- =============================================================
-- 5. Roads
-- =============================================================
INSERT INTO road (road_name, road_type, geom, lanes, speed_limit, is_one_way) VALUES
('Avinashi Road',         'primary',    ST_GeomFromText('LINESTRING(76.960 11.015, 77.000 11.020, 77.040 11.025, 77.080 11.030)', 4326), 4, 60, FALSE),
('Mettupalayam Road',     'primary',    ST_GeomFromText('LINESTRING(76.960 11.015, 76.950 11.030, 76.940 11.045)', 4326), 4, 60, FALSE),
('Race Course Road',      'secondary',  ST_GeomFromText('LINESTRING(76.940 11.005, 76.960 11.005, 76.975 11.010)', 4326), 2, 40, FALSE),
('DB Road',               'secondary',  ST_GeomFromText('LINESTRING(76.955 11.000, 76.965 11.010, 76.975 11.015)', 4326), 2, 40, FALSE),
('Trichy Road',           'primary',    ST_GeomFromText('LINESTRING(76.985 11.000, 77.005 10.995, 77.030 10.985)', 4326), 4, 60, FALSE),
('Saravanampatti Main',   'secondary',  ST_GeomFromText('LINESTRING(77.025 11.045, 77.040 11.060, 77.055 11.070)', 4326), 2, 40, FALSE),
('Airport Road',          'primary',    ST_GeomFromText('LINESTRING(77.020 11.020, 77.035 11.025, 77.050 11.028)', 4326), 4, 60, FALSE),
('Sathyamangalam Road',   'tertiary',   ST_GeomFromText('LINESTRING(76.930 11.020, 76.940 11.025, 76.950 11.030)', 4326), 2, 30, FALSE),
('Kalapatti Road',        'tertiary',   ST_GeomFromText('LINESTRING(77.025 11.050, 77.030 11.060, 77.035 11.070)', 4326), 2, 30, FALSE),
('Ukkadam Bypass',        'secondary',  ST_GeomFromText('LINESTRING(76.965 10.985, 76.980 10.992, 76.990 11.000)', 4326), 2, 50, FALSE)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 6. Businesses — disable oversaturation trigger for seeding
-- =============================================================
ALTER TABLE business DISABLE TRIGGER trg_prevent_oversaturation;
ALTER TABLE business DISABLE TRIGGER trg_recalculate_scores;
ALTER TABLE business DISABLE TRIGGER trg_recalc_on_deactivate;

INSERT INTO business (name, geom, address, type_id, demand_score, traffic_score) VALUES
-- CAFES
('Starbucks RS Puram',          ST_SetSRID(ST_MakePoint(76.960, 11.010), 4326), 'RS Puram, CBE',       (SELECT type_id FROM business_type WHERE type_name='cafe'), 82, 78),
('Cafe Coffee Day Gandhipuram', ST_SetSRID(ST_MakePoint(76.975, 11.022), 4326), 'Gandhipuram, CBE',    (SELECT type_id FROM business_type WHERE type_name='cafe'), 75, 72),
('Third Wave Coffee Peelamedu', ST_SetSRID(ST_MakePoint(77.010, 11.030), 4326), 'Peelamedu, CBE',      (SELECT type_id FROM business_type WHERE type_name='cafe'), 68, 65),
('Bean and Brew Saravanampatti',ST_SetSRID(ST_MakePoint(77.040, 11.065), 4326), 'Saravanampatti, CBE', (SELECT type_id FROM business_type WHERE type_name='cafe'), 60, 58),
('Brewnite Ukkadam',            ST_SetSRID(ST_MakePoint(76.970, 10.995), 4326), 'Ukkadam, CBE',        (SELECT type_id FROM business_type WHERE type_name='cafe'), 55, 52),

-- RESTAURANTS
('Annalakshmi Restaurant',      ST_SetSRID(ST_MakePoint(76.963, 11.008), 4326), 'RS Puram',        (SELECT type_id FROM business_type WHERE type_name='restaurant'), 88, 85),
('Hotel Tamil Nadu',            ST_SetSRID(ST_MakePoint(76.978, 11.020), 4326), 'Gandhipuram',     (SELECT type_id FROM business_type WHERE type_name='restaurant'), 78, 80),
('Saravana Bhavan',             ST_SetSRID(ST_MakePoint(77.005, 11.025), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='restaurant'), 85, 82),
('Pizza Hut Avinashi Road',     ST_SetSRID(ST_MakePoint(77.015, 11.022), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='restaurant'), 72, 70),
('KFC Race Course',             ST_SetSRID(ST_MakePoint(76.948, 11.010), 4326), 'Race Course',     (SELECT type_id FROM business_type WHERE type_name='restaurant'), 80, 76),

-- HOSPITALS
('Kovai Medical Center',        ST_SetSRID(ST_MakePoint(77.008, 11.022), 4326), 'Avinashi Rd',     (SELECT type_id FROM business_type WHERE type_name='hospital'), 90, 85),
('G Kuppuswamy Naidu Hospital', ST_SetSRID(ST_MakePoint(76.962, 11.012), 4326), 'Pappanaickenpalayam', (SELECT type_id FROM business_type WHERE type_name='hospital'), 88, 82),
('PSG Hospitals',               ST_SetSRID(ST_MakePoint(76.985, 11.028), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='hospital'), 92, 80),
('Sri Ramakrishna Hospital',    ST_SetSRID(ST_MakePoint(76.970, 11.018), 4326), 'Sidhapudur',      (SELECT type_id FROM business_type WHERE type_name='hospital'), 87, 78),

-- PHARMACIES
('Apollo Pharmacy RS Puram',    ST_SetSRID(ST_MakePoint(76.958, 11.007), 4326), 'RS Puram',        (SELECT type_id FROM business_type WHERE type_name='pharmacy'), 78, 75),
('MedPlus Gandhipuram',         ST_SetSRID(ST_MakePoint(76.972, 11.024), 4326), 'Gandhipuram',     (SELECT type_id FROM business_type WHERE type_name='pharmacy'), 72, 70),
('NetMeds Peelamedu',           ST_SetSRID(ST_MakePoint(77.012, 11.032), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='pharmacy'), 65, 62),
('Wellness Forever Ukkadam',    ST_SetSRID(ST_MakePoint(76.975, 10.992), 4326), 'Ukkadam',         (SELECT type_id FROM business_type WHERE type_name='pharmacy'), 60, 58),

-- EV STATIONS
('Tata Power EV Saravanampatti',ST_SetSRID(ST_MakePoint(77.045, 11.062), 4326), 'Saravanampatti',  (SELECT type_id FROM business_type WHERE type_name='ev_station'), 70, 65),
('Ather Grid Peelamedu',        ST_SetSRID(ST_MakePoint(77.018, 11.028), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='ev_station'), 68, 63),
('BPCL EV Hub Airport Road',    ST_SetSRID(ST_MakePoint(77.032, 11.022), 4326), 'Airport Area',    (SELECT type_id FROM business_type WHERE type_name='ev_station'), 72, 70),

-- FUEL STATIONS
('Indian Oil Avinashi',         ST_SetSRID(ST_MakePoint(77.022, 11.023), 4326), 'Avinashi Road',   (SELECT type_id FROM business_type WHERE type_name='fuel_station'), 80, 85),
('HP Petrol Trichy Road',       ST_SetSRID(ST_MakePoint(77.010, 10.998), 4326), 'Trichy Road',     (SELECT type_id FROM business_type WHERE type_name='fuel_station'), 78, 83),
('Bharat Petroleum Ukkadam',    ST_SetSRID(ST_MakePoint(76.982, 10.990), 4326), 'Ukkadam',         (SELECT type_id FROM business_type WHERE type_name='fuel_station'), 75, 80),
('IOCL Race Course',            ST_SetSRID(ST_MakePoint(76.952, 11.012), 4326), 'Race Course',     (SELECT type_id FROM business_type WHERE type_name='fuel_station'), 72, 78),

-- SCHOOLS
('PSG College of Technology',   ST_SetSRID(ST_MakePoint(76.993, 11.025), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='school'), 85, 70),
('SRKV School Ganapathy',       ST_SetSRID(ST_MakePoint(76.940, 11.030), 4326), 'Ganapathy',       (SELECT type_id FROM business_type WHERE type_name='school'), 80, 65),
('GRD Institute Saravanampatti',ST_SetSRID(ST_MakePoint(77.050, 11.068), 4326), 'Saravanampatti',  (SELECT type_id FROM business_type WHERE type_name='school'), 75, 60),

-- SUPERMARKETS
('Big Bazaar Gandhipuram',      ST_SetSRID(ST_MakePoint(76.976, 11.023), 4326), 'Gandhipuram',     (SELECT type_id FROM business_type WHERE type_name='supermarket'), 90, 88),
('DMart Peelamedu',             ST_SetSRID(ST_MakePoint(77.014, 11.035), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='supermarket'), 88, 85),
('Reliance Fresh RS Puram',     ST_SetSRID(ST_MakePoint(76.961, 11.009), 4326), 'RS Puram',        (SELECT type_id FROM business_type WHERE type_name='supermarket'), 82, 80),
('More Supermarket Sara.',       ST_SetSRID(ST_MakePoint(77.042, 11.064), 4326), 'Saravanampatti',  (SELECT type_id FROM business_type WHERE type_name='supermarket'), 70, 68),

-- BANKS
('SBI RS Puram',                ST_SetSRID(ST_MakePoint(76.957, 11.006), 4326), 'RS Puram',        (SELECT type_id FROM business_type WHERE type_name='bank'), 75, 72),
('HDFC Gandhipuram',            ST_SetSRID(ST_MakePoint(76.973, 11.021), 4326), 'Gandhipuram',     (SELECT type_id FROM business_type WHERE type_name='bank'), 78, 75),
('ICICI Peelamedu',             ST_SetSRID(ST_MakePoint(77.011, 11.031), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='bank'), 72, 70),
('Axis Bank Saravanampatti',    ST_SetSRID(ST_MakePoint(77.043, 11.063), 4326), 'Saravanampatti',  (SELECT type_id FROM business_type WHERE type_name='bank'), 65, 62),
('Canara Bank Ganapathy',       ST_SetSRID(ST_MakePoint(76.938, 11.028), 4326), 'Ganapathy',       (SELECT type_id FROM business_type WHERE type_name='bank'), 68, 65),

-- GYMS
('Golds Gym Avinashi Road',     ST_SetSRID(ST_MakePoint(77.019, 11.024), 4326), 'Avinashi Road',   (SELECT type_id FROM business_type WHERE type_name='gym'), 78, 75),
('Anytime Fitness Peelamedu',   ST_SetSRID(ST_MakePoint(77.016, 11.033), 4326), 'Peelamedu',       (SELECT type_id FROM business_type WHERE type_name='gym'), 72, 70),
('Snap Fitness Saravanampatti', ST_SetSRID(ST_MakePoint(77.038, 11.062), 4326), 'Saravanampatti',  (SELECT type_id FROM business_type WHERE type_name='gym'), 65, 62),
('CrossFit RS Puram',           ST_SetSRID(ST_MakePoint(76.956, 11.011), 4326), 'RS Puram',        (SELECT type_id FROM business_type WHERE type_name='gym'), 70, 68)
ON CONFLICT DO NOTHING;

-- Re-enable triggers
ALTER TABLE business ENABLE TRIGGER trg_prevent_oversaturation;
ALTER TABLE business ENABLE TRIGGER trg_recalculate_scores;
ALTER TABLE business ENABLE TRIGGER trg_recalc_on_deactivate;

-- =============================================================
-- 7. Assign zones to businesses
-- =============================================================
UPDATE business b
SET zone_id = (
    SELECT z.zone_id FROM zone z
    WHERE ST_Within(b.geom, z.geom)
    ORDER BY ST_Area(z.geom) ASC
    LIMIT 1
)
WHERE b.zone_id IS NULL;

-- =============================================================
-- 8. Refresh materialized view
-- =============================================================
REFRESH MATERIALIZED VIEW zone_business_density;

-- =============================================================
-- 9. Sample analysis requests
-- =============================================================
DO $$
DECLARE v_req_id INTEGER;
BEGIN
    SELECT save_analysis_request(
        (SELECT user_id FROM app_user WHERE username = 'admin'),
        (SELECT type_id FROM business_type WHERE type_name = 'cafe'),
        11.025, 77.050, 1000
    ) INTO v_req_id;
    RAISE NOTICE 'Sample request 1 created: %', v_req_id;

    SELECT save_analysis_request(
        (SELECT user_id FROM app_user WHERE username = 'demo_user'),
        (SELECT type_id FROM business_type WHERE type_name = 'ev_station'),
        11.000, 76.980, 1500
    ) INTO v_req_id;
    RAISE NOTICE 'Sample request 2 created: %', v_req_id;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Sample data notice: %', SQLERRM;
END;
$$;

-- Final verification
SELECT
    (SELECT COUNT(*) FROM app_user)      AS users,
    (SELECT COUNT(*) FROM business_type) AS business_types,
    (SELECT COUNT(*) FROM zone)          AS zones,
    (SELECT COUNT(*) FROM road)          AS roads,
    (SELECT COUNT(*) FROM business)      AS businesses,
    (SELECT COUNT(*) FROM score_factor)  AS score_factors;

SELECT 'Migration 05: Seed data loaded successfully.' AS status;
