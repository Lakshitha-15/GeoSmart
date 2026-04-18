// controllers/businessController.js
const businessService = require('../services/businessService');
const db = require('../../config/db');

async function getAll(req, res, next) {
  try {
    const { typeId, activeOnly = 'true', limit = 200 } = req.query;
    const businesses = await businessService.getAllBusinesses({
      typeId:     typeId ? parseInt(typeId) : undefined,
      activeOnly: activeOnly !== 'false',
      limit:      parseInt(limit),
    });
    res.json({ success: true, data: businesses, count: businesses.length });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const biz = await businessService.getBusinessById(parseInt(req.params.id));
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    res.json({ success: true, data: biz });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, lat, lon, address, typeId, demandScore, trafficScore } = req.body;
    if (!name || lat == null || lon == null || !typeId) {
      return res.status(400).json({ error: 'name, lat, lon, typeId are required' });
    }
    const biz = await businessService.createBusiness({
      name, lat: parseFloat(lat), lon: parseFloat(lon),
      address, typeId: parseInt(typeId),
      demandScore: demandScore ? parseFloat(demandScore) : undefined,
      trafficScore: trafficScore ? parseFloat(trafficScore) : undefined,
    });
    res.status(201).json({ success: true, data: biz });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const biz = await businessService.updateBusiness(parseInt(req.params.id), req.body);
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    res.json({ success: true, data: biz });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const deleted = await businessService.deleteBusiness(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Business not found' });
    res.json({ success: true, message: 'Business deleted' });
  } catch (err) {
    next(err);
  }
}

async function getTypes(req, res, next) {
  try {
    const res2 = await db.query(
      `SELECT type_id AS id, type_name AS name, display_label, icon_name,
              ideal_min_distance, max_density_per_km2,
              demand_weight, competition_weight, road_weight, zone_weight
       FROM business_type ORDER BY display_label`
    );
    res.json({ success: true, data: res2.rows });
  } catch (err) {
    next(err);
  }
}

async function getZones(req, res, next) {
  try {
    const res2 = await db.query(
      `SELECT
         zone_id AS id,
         zone_name AS name,
         zone_type,
         population_density,
         avg_income_level,
         ROUND(ST_Area(geom::geography)::NUMERIC / 1e6, 4) AS area_sqkm,
         ST_AsGeoJSON(geom)::json AS geometry
       FROM zone
       ORDER BY zone_name`
    );
    res.json({ success: true, data: res2.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getOne, create, update, remove, getTypes, getZones };
