// controllers/analysisController.js
const { validationResult } = require('express-validator');
const analysisService = require('../services/analysisService');

const DEFAULT_USER_ID = 1; // In production, extract from JWT/session

async function analyzeLocation(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lat, lon, typeId, radiusM = 1000 } = req.body;
    const userId = req.user?.id || DEFAULT_USER_ID;

    const result = await analysisService.analyzeLocation({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      typeId: parseInt(typeId),
      userId,
      radiusM: parseFloat(radiusM),
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getAnalysisById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await analysisService.getAnalysisById(parseInt(id));
    if (!result) return res.status(404).json({ error: 'Analysis not found' });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getBestLocations(req, res, next) {
  try {
    const { typeId } = req.params;
    const topN = parseInt(req.query.top) || 10;
    const results = await analysisService.getBestLocations(parseInt(typeId), topN);
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    next(err);
  }
}

async function getTopRanked(req, res, next) {
  try {
    const typeId = req.query.typeId ? parseInt(req.query.typeId) : null;
    const limit  = parseInt(req.query.limit) || 10;
    const results = await analysisService.getTopRankedLocations(typeId, limit);
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    next(err);
  }
}

async function getLowCompetition(req, res, next) {
  try {
    const typeId     = parseInt(req.query.typeId);
    const maxDensity = parseFloat(req.query.maxDensity) || 2.0;
    if (!typeId) return res.status(400).json({ error: 'typeId is required' });
    const results = await analysisService.getLowCompetitionZones(typeId, maxDensity);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

async function compareTwoLocations(req, res, next) {
  try {
    const { lat1, lon1, lat2, lon2, typeId, radiusM = 1000 } = req.body;
    if (!lat1 || !lon1 || !lat2 || !lon2 || !typeId) {
      return res.status(400).json({ error: 'lat1, lon1, lat2, lon2, typeId are required' });
    }
    const result = await analysisService.compareTwoLocations({
      lat1: parseFloat(lat1), lon1: parseFloat(lon1),
      lat2: parseFloat(lat2), lon2: parseFloat(lon2),
      typeId: parseInt(typeId),
      radiusM: parseFloat(radiusM),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getUnderserved(req, res, next) {
  try {
    const typeId       = parseInt(req.query.typeId);
    const minPop       = parseFloat(req.query.minPopulation) || 3000;
    const maxBusiness  = parseInt(req.query.maxBusinesses) || 2;
    if (!typeId) return res.status(400).json({ error: 'typeId is required' });
    const results = await analysisService.getUnderservedAreas(typeId, minPop, maxBusiness);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  analyzeLocation,
  getAnalysisById,
  getBestLocations,
  getTopRanked,
  getLowCompetition,
  compareTwoLocations,
  getUnderserved,
};
