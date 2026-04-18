// services/businessService.js
const db = require('../../config/db');

async function getAllBusinesses({ typeId, activeOnly = true, limit = 200 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (activeOnly) { conditions.push(`b.is_active = TRUE`); }
  if (typeId)     { conditions.push(`b.type_id = $${idx++}`); params.push(typeId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const res = await db.query(
    `SELECT
       b.business_id,
       b.name,
       b.address,
       ST_Y(b.geom) AS lat,
       ST_X(b.geom) AS lon,
       b.demand_score,
       b.traffic_score,
       b.is_active,
       b.created_at,
       bt.type_name,
       bt.display_label,
       bt.icon_name,
       z.zone_name,
       z.zone_type
     FROM business b
     JOIN business_type bt ON b.type_id = bt.type_id
     LEFT JOIN zone z ON b.zone_id = z.zone_id
     ${where}
     ORDER BY b.created_at DESC
     LIMIT $${idx}`,
    params
  );

  return res.rows.map(formatBusiness);
}

async function getBusinessById(id) {
  const res = await db.query(
    `SELECT
       b.*,
       ST_Y(b.geom) AS lat,
       ST_X(b.geom) AS lon,
       bt.type_name,
       bt.display_label,
       z.zone_name,
       z.zone_type,
       z.population_density
     FROM business b
     JOIN business_type bt ON b.type_id = bt.type_id
     LEFT JOIN zone z ON b.zone_id = z.zone_id
     WHERE b.business_id = $1`,
    [id]
  );
  if (!res.rows.length) return null;
  return formatBusiness(res.rows[0]);
}

async function createBusiness({ name, lat, lon, address, typeId, demandScore = 50, trafficScore = 50 }) {
  const res = await db.query(
    `INSERT INTO business (name, geom, address, type_id, demand_score, traffic_score)
     VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326), $4, $5, $6, $7)
     RETURNING business_id`,
    [name, lat, lon, address, typeId, demandScore, trafficScore]
  );
  return getBusinessById(res.rows[0].business_id);
}

async function updateBusiness(id, { name, address, demandScore, trafficScore, isActive }) {
  const res = await db.query(
    `UPDATE business
     SET name          = COALESCE($2, name),
         address       = COALESCE($3, address),
         demand_score  = COALESCE($4, demand_score),
         traffic_score = COALESCE($5, traffic_score),
         is_active     = COALESCE($6, is_active)
     WHERE business_id = $1
     RETURNING business_id`,
    [id, name, address, demandScore, trafficScore, isActive]
  );
  if (!res.rows.length) return null;
  return getBusinessById(id);
}

async function deleteBusiness(id) {
  const res = await db.query(
    `DELETE FROM business WHERE business_id = $1 RETURNING business_id`,
    [id]
  );
  return res.rows.length > 0;
}

function formatBusiness(row) {
  return {
    id:           row.business_id,
    name:         row.name,
    address:      row.address,
    lat:          parseFloat(row.lat),
    lon:          parseFloat(row.lon),
    demandScore:  parseFloat(row.demand_score),
    trafficScore: parseFloat(row.traffic_score),
    isActive:     row.is_active,
    createdAt:    row.created_at,
    type: {
      name:         row.type_name,
      displayLabel: row.display_label,
      iconName:     row.icon_name,
    },
    zone: row.zone_name ? {
      name: row.zone_name,
      type: row.zone_type,
    } : null,
  };
}

module.exports = { getAllBusinesses, getBusinessById, createBusiness, updateBusiness, deleteBusiness };
