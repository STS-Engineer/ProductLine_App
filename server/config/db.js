// Dependencies: require('pg'), require('dotenv')
// Load environment variables from .env file
require('dotenv').config();

const { Pool } = require('pg');

// Use env variables for secure connection details
const pool = new Pool({
  user: process.env.DB_USER,        // e.g., 'administrationSTS'
  host: process.env.DB_HOST,        // e.g., 'localhost' or your server address
  database: process.env.DB_NAME,    // e.g., 'product_db'
  password: process.env.DB_PASSWORD, // Your password
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
