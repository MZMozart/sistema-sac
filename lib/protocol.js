// Protocol generation utility for attendances
// Example for Node.js/Express with PostgreSQL

const { Pool } = require('pg');
const pool = new Pool();

/**
 * Generate a unique protocol for a new conversation
 * @param {string} channel - 'chat', 'call', 'bot'
 * @returns {Promise<string>} protocol
 */
async function generateProtocol(channel) {
  const year = new Date().getFullYear();
  const prefix = {
    chat: 'CHT',
    call: 'CAL',
    bot: 'BOT',
  };
  const result = await pool.query(
    `SELECT COUNT(*) FROM conversations WHERE created_at >= $1`,
    [`${year}-01-01`]
  );
  const number = parseInt(result.rows[0].count) + 1;
  return `${prefix[channel]}-${year}-${number.toString().padStart(6, '0')}`;
}

module.exports = { generateProtocol };
