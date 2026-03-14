const express = require('express');
const path = require('path');
const fs = require('fs');
const { createGunzip } = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;

// Determine which database to use
const usePostgres = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL?.includes('postgres');
let db = null;
let postgres = null;
let dbReady = false;

// Initialize database
if (usePostgres) {
  // Use Vercel Postgres
  const { sql } = require('@vercel/postgres');
  postgres = sql;
  console.log('✓ Using Vercel Postgres');
} else {
  // Use SQLite for local development or Render persistent disk
  const sqlite3 = require('sqlite3').verbose();
  
  // Support DATABASE_PATH env variable (for Render persistent disk)
  // Falls back to local data/bins.db for development
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'bins.db');
  const compressedDbPath = path.join(__dirname, 'data', 'bins.db.gz');
  const localDbPath = path.join(__dirname, 'data', 'bins.db');
  
  console.log('Database path:', dbPath);

  // Decompress database if needed
  function ensureDatabase() {
    return new Promise((resolve, reject) => {
      // Check if uncompressed database exists at target location
      if (fs.existsSync(dbPath)) {
        console.log('✓ Database found:', dbPath);
        resolve();
        return;
      }

      // Try to copy/decompress from git repo
      console.log('⏳ Initializing database from git...');
      
      try {
        // First, try to use uncompressed local copy
        if (fs.existsSync(localDbPath)) {
          console.log('✓ Copying database from local to persistent storage...');
          const data = fs.readFileSync(localDbPath);
          
          // Ensure target directory exists
          const dbDir = path.dirname(dbPath);
          if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
          }
          
          fs.writeFileSync(dbPath, data);
          console.log('✓ Database copied successfully');
          resolve();
          return;
        }
        
        // Try compressed copy
        if (fs.existsSync(compressedDbPath)) {
          console.log('✓ Decompressing database from git...');
          const { gunzipSync } = require('zlib');
          
          const buffer = fs.readFileSync(compressedDbPath);
          const decompressed = gunzipSync(buffer);
          
          // Ensure target directory exists
          const dbDir = path.dirname(dbPath);
          if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
          }
          
          fs.writeFileSync(dbPath, decompressed);
          console.log('✓ Database ready');
          resolve();
          return;
        }
        
        // No database found anywhere
        console.error('✗ No database file found');
        console.error('  Looked for:', localDbPath, 'and', compressedDbPath);
        reject(new Error('Database file not found'));
      } catch (err) {
        console.error('✗ Database initialization error:', err.message);
        reject(err);
      }
    });
  }

  // Initialize SQLite
  console.log('Initializing SQLite...');
  ensureDatabase().then(() => {
    console.log('Opening SQLite database file...');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('✗ Error connecting to database:', err.message);
        console.error('  Database path:', dbPath);
      } else {
        console.log('✓ SQLite connection established');
        // Check database and get record count
        db.get('SELECT COUNT(*) as count FROM bins', (err, row) => {
          if (err) {
            console.warn('✗ bins table not found:', err.message);
            dbReady = false;
          } else {
            const recordCount = row?.count || 0;
            console.log(`✓ Database loaded with ${recordCount.toLocaleString()} BIN records`);
            dbReady = true;
          }
        });
      }
    });
  }).catch(err => {
    console.error('✗ Failed to initialize database:', err.message);
    dbReady = false;
  });
}

app.use(express.static('public'));
app.use(express.json());

app.post('/api/search', async (req, res) => {
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

  try {
    let matches = [];

    if (usePostgres && postgres) {
      // Query Vercel Postgres
      const result = await postgres`
        SELECT id, bin, card_brand, issuer, card_type, card_level, country_name, 
               country_code_a2, country_code_a3, country_code_numeric, bank_website, 
               bank_phone, pan_length, personal_commercial, regulated 
        FROM bins 
        WHERE bin LIKE ${searchBin + '%'} 
        LIMIT 100
      `;
      matches = result.rows || [];
    } else {
      // Query SQLite
      if (!db || !dbReady) {
        return res.status(503).json({ error: 'Database not ready' });
      }

      matches = await new Promise((resolve, reject) => {
        db.all(
          'SELECT id, bin, card_brand, issuer, card_type, card_level, country_name, country_code_a2, country_code_a3, country_code_numeric, bank_website, bank_phone, pan_length, personal_commercial, regulated FROM bins WHERE bin LIKE ? LIMIT 100',
          [`${searchBin}%`],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
    }
    
    res.json({
      count: matches.length,
      matches: matches,
      searchedBin: searchBin,
      binLength: binLength
    });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    if (usePostgres && postgres) {
      const result = await postgres`SELECT COUNT(*) as count FROM bins`;
      const recordCount = result.rows[0]?.count || 0;
      res.json({
        status: 'ok',
        database: 'postgres',
        ready: true,
        recordCount: recordCount
      });
    } else {
      const ready = dbReady && db !== null;
      res.json({
        status: ready ? 'ok' : 'loading',
        database: 'sqlite',
        ready: ready,
        recordCount: 'check logs'
      });
    }
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 BIN Search server running at http://localhost:${PORT}`);
});

// Debug endpoint to check files
app.get('/api/debug/files', (req, res) => {
  const dataDir = path.join(__dirname, 'data');
  try {
    const files = fs.readdirSync(dataDir);
    const fileInfo = {};
    files.forEach(f => {
      const stats = fs.statSync(path.join(dataDir, f));
      fileInfo[f] = {
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        mtime: stats.mtime
      };
    });
    res.json({
      dataDir: dataDir,
      files: fileInfo,
      dbReady: dbReady,
      db: db ? 'connected' : 'not connected'
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      dataDir: dataDir
    });
  }
});
