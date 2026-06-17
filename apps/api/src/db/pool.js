const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.DATABASE_URL
});

async function query(text, params = [], client = pool) {
  return client.query(text, params);
}

async function one(text, params = [], client = pool) {
  const result = await query(text, params, client);
  return result.rows[0] || null;
}

async function many(text, params = [], client = pool) {
  const result = await query(text, params, client);
  return result.rows;
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, one, many, withTransaction, closePool };
