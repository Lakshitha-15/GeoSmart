// routes/index.js
const express = require('express');
const { body, query, param, validationResult } = require('express-validator');

const analysisCtrl = require('../controllers/analysisController');
const businessCtrl = require('../controllers/businessController');

const router = express.Router();


// ─── Validation Middleware ────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      errors: errors.array()
    });
  }
  next();
};


// ─── Health Check ─────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'GeoSmart API',
    time: new Date().toISOString()
  });
});


// ─── Business Types ───────────────────────────────────────────
router.get('/business-types', businessCtrl.getTypes);


// ─── Zones ────────────────────────────────────────────────────
router.get('/zones', businessCtrl.getZones);


// ─── Businesses CRUD ─────────────────────────────────────────
router.get('/businesses', businessCtrl.getAll);

router.get('/businesses/:id',
  param('id').isInt(),
  validate,
  businessCtrl.getOne
);

router.post('/businesses',
  body('name').notEmpty().trim().isLength({ max: 300 }),
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lon').isFloat({ min: -180, max: 180 }),
  body('typeId').isInt({ min: 1 }),
  validate,
  businessCtrl.create
);

router.put('/businesses/:id',
  param('id').isInt(),
  validate,
  businessCtrl.update
);

router.delete('/businesses/:id',
  param('id').isInt(),
  validate,
  businessCtrl.remove
);


// ─── Core Analysis (map click) ────────────────────────────────
router.post('/analyze',
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lon').isFloat({ min: -180, max: 180 }),
  body('typeId').isInt({ min: 1 }),
  body('radiusM').optional().isFloat({ min: 100, max: 10000 }),
  validate,
  analysisCtrl.analyzeLocation
);

// ─── Advanced Spatial Queries ─────────────────────────────────

// Best candidate locations
router.get('/analysis/best-locations/:typeId',
  param('typeId').isInt(),
  query('top').optional().isInt({ min: 1, max: 50 }),
  validate,
  analysisCtrl.getBestLocations
);

// Top ranked locations
router.get('/analysis/top-10',
  query('typeId').optional().isInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
  analysisCtrl.getTopRanked
);

// Low competition zones
router.get('/analysis/low-competition',
  query('typeId').isInt(),
  query('maxDensity').optional().isFloat({ min: 0, max: 100 }),
  validate,
  analysisCtrl.getLowCompetition
);

// Compare two locations
router.post('/analysis/compare',
  body('lat1').isFloat(),
  body('lon1').isFloat(),
  body('lat2').isFloat(),
  body('lon2').isFloat(),
  body('typeId').isInt(),
  validate,
  analysisCtrl.compareTwoLocations
);

// Underserved areas
router.get('/analysis/underserved',
  query('typeId').isInt(),
  query('minPopulation').optional().isFloat(),
  query('maxBusinesses').optional().isInt(),
  validate,
  analysisCtrl.getUnderserved
);

router.get('/analysis/:id',
  param('id').isInt(),
  validate,
  analysisCtrl.getAnalysisById
);

module.exports = router;