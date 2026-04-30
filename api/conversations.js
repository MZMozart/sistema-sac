// API endpoint to fetch real attendances (conversations)
// Example for Node.js/Express with PostgreSQL

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool();

// GET /api/conversations?search=...&period=...
router.get('/conversations', async (req, res) => {
  const { search, period } = req.query;
  let query = `SELECT c.*, u.name as customer_name, a.name as agent_name FROM conversations c
    LEFT JOIN users u ON c.customer_id = u.id
    LEFT JOIN users a ON c.agent_id = a.id
    WHERE 1=1`;
  const params = [];

  if (search) {
    query += ` AND (c.protocol ILIKE $${params.length + 1} OR u.name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`;
    params.push(`%${search}%`);
  }
  if (period) {
    query += ` AND c.created_at >= $${params.length + 1}`;
    params.push(period);
  }
  query += ' ORDER BY c.created_at DESC LIMIT 100';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;
