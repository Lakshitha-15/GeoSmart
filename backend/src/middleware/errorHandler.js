// middleware/errorHandler.js

function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.stack || err.message);

  // PostgreSQL-specific errors
  if (err.code === 'P0001') {
    return res.status(409).json({
      error: 'Business insertion blocked',
      message: err.message,
      type: 'OVERSATURATION_ERROR',
    });
  }
  if (err.code === 'P0002') {
    return res.status(400).json({
      error: 'Validation failed',
      message: err.message,
      type: 'WEIGHT_SUM_ERROR',
    });
  }
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate entry',
      message: 'A record with this value already exists.',
      type: 'UNIQUE_VIOLATION',
    });
  }
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Foreign key violation',
      message: 'Referenced record does not exist.',
      type: 'FK_VIOLATION',
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    type: 'SERVER_ERROR',
  });
}

module.exports = errorHandler;
