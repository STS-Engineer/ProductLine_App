// /server/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Loads .env file for PORT and DB details
const db = require('./config/db'); // Initialize PG Pool
const authMiddleware = require('./middleware/authMiddleware');
const dataController = require('./controllers/dataController');
const authController = require('./controllers/authController');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware Setup ---
app.use(cors()); // Enable CORS for client communication
app.use(express.json()); // Body parser for JSON requests

// --- Database Health Check ---
db.query('SELECT 1')
  .then(() => console.log('[DB] PostgreSQL connected successfully.'))
  .catch(err => {
    console.error('[DB] Connection Error:', err.message);
    // process.exit(1); // Optional: Stop server if DB connection fails
  });

// --- Authentication Routes (Public) ---
app.post('/api/auth/signup', authController.signup);
app.post('/api/auth/login', authController.login);

// --- Protected CRUD Routes (Requires Token Authentication) ---
app.use('/api', authMiddleware); // Apply middleware to all routes below

// Universal CRUD Routes for 'product_lines', 'products', and 'audit_logs'
app.get('/api/:collectionName', dataController.getItems);
app.post('/api/:collectionName', dataController.createItem);
app.put('/api/:collectionName/:id', dataController.updateItem);
app.delete('/api/:collectionName/:id', dataController.deleteItem);


// --- Server Start ---
app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});
