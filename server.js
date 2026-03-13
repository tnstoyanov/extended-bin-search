const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(express.static('public'));
app.use(express.json());

// Check database connection and table
pool.query(
  "SELECT to_regclass('public.bins')",
  (err, res) => {
    if (err) {
      console.error('Error checking database:', err);
      return;
    }
    if (!res.rows[0].to_regclass) {
      console.warn('bins table not found. Run: npm run init-db');
    } else {
      pool.query('SELECT COUNT(*) as count FROM bins', (err, res) => {
        if (!err) {
          const count = res.rows[0].count;
          console.log(`Database loaded with ${count} BIN records`);
        }
      });
    }
  }
);

app.post('/api/search', (req, res) => {
  const { bin } = req.body;

  if (!bin) {
    return res.status(400).json({ error: 'bin parameter required' });
  }

  const searchBin = bin.toString().trim();
  const binLength = searchBin.length;

  if (binLength < 6 || binLength > 11) {
    return res.status(400).json({ 
      error: 'Your BIN should be 6-11 digits!',
      count: 0,
      matches: []
    });
  }

  pool.query(
    'SELECT id, bin, card_brand, issuer, card_type, card_level, country_name, country_code_a2, country_code_a3, country_code_numeric, bank_website, bank_phone, pan_length, personal_commercial, regulated FROM bins WHERE bin LIKE $1 LIMIT 100',
    [`${searchBin}%`],
    (err, result) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const matches = result.rows || [];
      
      res.json({
        count: matches.length,
        matches: matches,
        searchedBin: searchBin,
        binLength: binLength
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`BIN Search server running at http://localhost:${PORT}`);
});
