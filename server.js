const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

const dbPath = path.join(__dirname, 'data', 'bins.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    console.log('Run: npm run init-db');
    process.exit(1);
  }
  console.log('Connected to BIN database');
});

db.get(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='bins'",
  (err, row) => {
    if (err) {
      console.error('Error checking database:', err);
      return;
    }
    if (!row) {
      console.warn('bins table not found. Run: npm run init-db');
    } else {
      db.get('SELECT COUNT(*) as count FROM bins', (err, row) => {
        if (!err) {
          console.log(`Database loaded with ${row.count} BIN records`);
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

  db.all(
    'SELECT id, bin, card_brand, issuer, card_type, card_level, country_name, country_code_a2, country_code_a3, country_code_numeric, bank_website, bank_phone, pan_length, personal_commercial, regulated FROM bins WHERE bin LIKE ? LIMIT 100',
    [`${searchBin}%`],
    (err, rows) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const matches = rows || [];
      
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
