// services/analysisService.js
const db = require('../../config/db');

/**
 * Run full spatial analysis for a clicked location.
 * Calls the PostgreSQL stored procedure analyze_location()
 * and generate_explanation(), then saves via save_analysis_request().
 */
async function analyzeLocation({ lat, lon, typeId, userId, radiusM = 1000 }) {
  // Call the stored function that runs all spatial queries
  const analysisRes = await db.query(
    `SELECT analyze_location($1, $2, $3, $4) AS analysis`,
    [lat, lon, typeId, radiusM]
  );
  const analysis = analysisRes.rows[0].analysis;

  // Get type name for explanation
  const typeRes = await db.query(
    `SELECT type_name, display_label FROM business_type WHERE type_id = $1`,
    [typeId]
  );
  if (!typeRes.rows.length) throw Object.assign(new Error('Business type not found'), { status: 404 });
  const typeName = typeRes.rows[0].display_label;

  // Generate human-readable explanation
  const explRes = await db.query(
    `SELECT generate_explanation($1::jsonb, $2) AS explanation`,
    [JSON.stringify(analysis), typeName]
  );
  const explanation = explRes.rows[0].explanation;

  // Save everything atomically via transaction stored procedure
  const saveRes = await db.query(
    `SELECT save_analysis_request($1, $2, $3, $4, $5) AS request_id`,
    [userId, typeId, lat, lon, radiusM]
  );
  const requestId = saveRes.rows[0].request_id;

  // Fetch nearby competitors for the response
  const competitorsRes = await db.query(
    `SELECT
       b.business_id,
       b.name,
       b.address,
       ST_Y(b.geom) AS lat,
       ST_X(b.geom) AS lon,
       ST_Distance(b.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_m,
       bt.type_name
     FROM business b
     JOIN business_type bt ON b.type_id = bt.type_id
     WHERE b.type_id = $3
       AND b.is_active = TRUE
       AND ST_DWithin(b.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $4)
     ORDER BY distance_m ASC
     LIMIT 10`,
    [lat, lon, typeId, radiusM]
  );

  return {
    requestId,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    finalScore: analysis.final_score,
    competitionDensity: analysis.competition_density,
    competitorCount: analysis.competitor_count,
    scores: analysis.scores,
    weights: analysis.weights,
    zone: analysis.zone,
    roadCount: analysis.road_count,
    primaryRoads: analysis.primary_roads,
    recommendation: explanation,
    competitors: competitorsRes.rows.map(r => ({
      id: r.business_id,
      name: r.name,
      address: r.address,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      distanceM: Math.round(r.distance_m),
      typeName: r.type_name,
    })),
  };
}

/**
 * Retrieve full saved analysis by request ID.
 */
async function getAnalysisById(requestId) {
  const res = await db.query(
    `SELECT
       ar.request_id,
       ar.clicked_lat       AS lat,
       ar.clicked_lon       AS lon,
       ar.final_score,
       ar.competition_density,
       ar.explanation_text,
       ar.requested_at,
       ar.completed_at,
       ar.search_radius_m,
       bt.type_name,
       bt.display_label,
       r.recommendation_type,
       r.title,
       r.body_text,
       r.pros_list,
       r.cons_list,
       json_agg(json_build_object(
           'factor', sf.factor_name,
           'raw_value', ls.raw_value,
           'weighted_score', ls.weighted_score,
           'weight', ls.applied_weight
       )) AS factor_scores
     FROM analysis_request ar
     JOIN business_type bt ON ar.type_id = bt.type_id
     LEFT JOIN recommendation r ON r.request_id = ar.request_id
     LEFT JOIN location_score ls ON ls.request_id = ar.request_id
     LEFT JOIN score_factor sf ON sf.factor_id = ls.factor_id
     WHERE ar.request_id = $1
     GROUP BY ar.request_id, bt.type_name, bt.display_label,
              r.recommendation_type, r.title, r.body_text, r.pros_list, r.cons_list`,
    [requestId]
  );
  return res.rows[0] || null;
}

/**
 * Get best candidate locations for a business type.
 * Calls find_best_locations() stored function.
 */
async function getBestLocations(typeId, topN = 10) {
  const res = await db.query(
    `SELECT * FROM find_best_locations($1, NULL, $2, 500)`,
    [typeId, topN]
  );
  return res.rows;
}

/**
 * Get top ranked existing businesses.
 */
async function getTopRankedLocations(typeId = null, limit = 10) {
  const res = await db.query(
    `SELECT * FROM get_top_ranked_locations($1, $2)`,
    [typeId, limit]
  );
  return res.rows;
}

/**
 * Get low competition zones.
 */
async function getLowCompetitionZones(typeId, maxDensity = 2.0) {
  const res = await db.query(
    `SELECT * FROM find_low_competition_zones($1, $2)`,
    [typeId, maxDensity]
  );
  return res.rows;
}

/**
 * Compare two locations side-by-side.
 */
async function compareTwoLocations({ lat1, lon1, lat2, lon2, typeId, radiusM = 1000 }) {
  const res = await db.query(
    `SELECT compare_two_locations($1,$2,$3,$4,$5,$6) AS comparison`,
    [lat1, lon1, lat2, lon2, typeId, radiusM]
  );
  return res.rows[0].comparison;
}

/**
 * Get underserved areas for a business type.
 */
async function getUnderservedAreas(typeId, minPopulation = 3000, maxBusinesses = 2) {
  const res = await db.query(
    `SELECT * FROM get_underserved_areas($1, $2, $3)`,
    [typeId, minPopulation, maxBusinesses]
  );
  return res.rows;
}

module.exports = {
  analyzeLocation,
  getAnalysisById,
  getBestLocations,
  getTopRankedLocations,
  getLowCompetitionZones,
  compareTwoLocations,
  getUnderservedAreas,
};
