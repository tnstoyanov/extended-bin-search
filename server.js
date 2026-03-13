const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { createGunzip } = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'data', 'bins.db');
const compressedDbPath = path.join(__dirname, 'data', 'bins.db.gz');

// Decompress database if needed
function ensureDatabase() {
  return new Promise((resolve, reject) => {
    // Check if uncompressed database exists
    if (fs.existsSync(dbPath)) {
      resolve();
      return;
    }

    // Check if compressed database exists
    if (fs.existsSync(compressedDbPath)) {
      console.log('Decompressing database...');
      const gunzip = createGunzip();
      const source = fs.createReadStream(compressedDbPath);
      const dest = fs.createWriteStream(dbPath);
      
      source.pipe(gunzip).pipe(dest);
      
      dest.on('finish', () => {
        console.log('Database decompressed successfully');
        resolve();
      });
      
      dest.on('error', (err) => {
        console.error('Decompression error:', err);
        reject(err);
      });
    } else {
      reject(new Error('Database file not found'));
    }
  });
}

// Initialize database
let db;
ensureDatabase().then(() => {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      console.error('Database path:', dbPath);
      console.warn('bins table not found. Run: npm run init-db');
    } else {
      // Check database and get record count
      db.get('SELECT COUNT(*) as count FROM bins', (err, row) => {
        if (err) {
          console.warn('bins table not found. Run: npm run init-db');
        } else {
          const recordCount = row?.count || 0;
          console.log(`✓ Database loaded with ${recordCount.toLocaleString()} BIN records`);
        }
      });
    }
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

app.use(express.static('public'));
app.use(express.json());

app.post('/api/search', (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not ready' });
  }

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
  console.log(`🚀 BIN Search server running at http://localhost:${PORT}`);
});
