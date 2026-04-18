// config/db.js — PostgreSQL connection pool
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'geosmart',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max:      20,           // max connections in pool
  idleTimeoutMillis:  30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

/**
 * Execute a parameterized query.
 * @param {string} text - SQL query
 * @param {Array}  params - query parameters
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] ${duration}ms | rows: ${res.rowCount} | ${text.slice(0, 80)}`);
    }
    return res;
  } catch (err) {
    console.error('[DB ERROR]', err.message, '\nQuery:', text, '\nParams:', params);
    throw err;
  }
}

/**
 * Execute a function inside a transaction.
 * @param {Function} fn - async (client) => result
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, pool };
