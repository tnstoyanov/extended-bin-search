const express = require('express');
const path = require('path');
const fs = require('fs');
const { createGunzip } = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup logging utility with timestamps
const log = (msg, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${msg}`);
};

// Log startup environment
log('=== APPLICATION STARTUP ===');
log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
log(`Port: ${PORT}`);
log(`Platform: ${process.platform} ${process.arch}`);
log(`Working Directory: ${process.cwd()}`);
log(`__dirname: ${__dirname}`);
log(`DATABASE_PATH env var: ${process.env.DATABASE_PATH || 'NOT SET'}`);
log(`RENDER env var: ${process.env.RENDER || 'NOT SET'}`);
log(`HOME: ${process.env.HOME || 'NOT SET'}`);

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
  log('✓ Using Vercel Postgres');
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
      log(`Checking for existing database...`);
      log(`Primary path: ${dbPath}`, 'INFO');
      log(`Backup/compressed path: ${compressedDbPath}`, 'INFO');
      log(`Local fallback path: ${localDbPath}`, 'INFO');
      
      try {
        // First, try to use uncompressed local copy
        if (fs.existsSync(localDbPath)) {
          log(`Found local database at ${localDbPath}, copying...`, 'INFO');
          const stats = fs.statSync(localDbPath);
          log(`Local database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'INFO');
          
          const data = fs.readFileSync(localDbPath);
          
          // Ensure target directory exists
          const dbDir = path.dirname(dbPath);
          if (!fs.existsSync(dbDir)) {
            log(`Creating target directory: ${dbDir}`, 'INFO');
            fs.mkdirSync(dbDir, { recursive: true });
          }
          
          fs.writeFileSync(dbPath, data);
          log(`✓ Database copied to ${dbPath}`, 'SUCCESS');
          resolve();
          return;
        }
        
        // Try compressed copy with STREAMING (memory efficient)
        if (fs.existsSync(compressedDbPath)) {
          log(`Found compressed database, starting decompression...`, 'INFO');
          const compStats = fs.statSync(compressedDbPath);
          log(`Compressed size: ${(compStats.size / 1024 / 1024).toFixed(2)} MB`, 'INFO');
          
          // Ensure target directory exists
          const dbDir = path.dirname(dbPath);
          if (!fs.existsSync(dbDir)) {
            log(`Creating target directory: ${dbDir}`, 'INFO');
            fs.mkdirSync(dbDir, { recursive: true });
          }
          
          const gunzip = createGunzip();
          const source = fs.createReadStream(compressedDbPath);
          const dest = fs.createWriteStream(dbPath);
          
          let bytesWritten = 0;
          dest.on('data', (chunk) => {
            bytesWritten += chunk.length;
          });
          
          source.pipe(gunzip).pipe(dest);
          
          dest.on('finish', () => {
            const finalStats = fs.statSync(dbPath);
            log(`✓ Database decompressed successfully (${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`, 'SUCCESS');
            resolve();
          });
          
          dest.on('error', (err) => {
            log(`✗ Write error during decompression: ${err.message}`, 'ERROR');
            reject(err);
          });
          
          source.on('error', (err) => {
            log(`✗ Read error during decompression: ${err.message}`, 'ERROR');
            reject(err);
          });
          
          gunzip.on('error', (err) => {
            log(`✗ Gunzip error: ${err.message}`, 'ERROR');
            reject(err);
          });
          return;
        }
        
        // No database found anywhere
        const dbDir = path.dirname(dbPath);
        log(`✗ No database file found anywhere`, 'ERROR');
        log(`  Looked in local repo for: ${localDbPath}`, 'ERROR');
        log(`  Looked in local repo for compressed: ${compressedDbPath}`, 'ERROR');
        log(``, 'ERROR');
        log(`  Target path is: ${dbPath}`, 'ERROR');
        log(`  Target directory: ${dbDir}`, 'ERROR');
        
        // Try to help with diagnostics
        try {
          const dirExists = fs.existsSync(dbDir);
          log(`  Target dir exists: ${dirExists}`, 'ERROR');
          if (dirExists) {
            log(`  Files in target dir: ${fs.readdirSync(dbDir).join(', ')}`, 'ERROR');
          }
        } catch (e) {
          log(`  Cannot read target directory: ${e.message}`, 'ERROR');
        }
        
        log(``, 'ERROR');
        log(`SOLUTION: Make sure bins.db.gz is committed to git and present in data/ directory`, 'INFO');
        reject(new Error('Database file not found'));
      } catch (err) {
        log(`✗ Database initialization error: ${err.message}`, 'ERROR');
        reject(err);
      }
    });
  }

  // Initialize SQLite
  log('Initializing SQLite database...', 'INFO');
  ensureDatabase().then(() => {
    log(`Opening SQLite database file from ${dbPath}...`, 'INFO');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        log(`✗ Error connecting to database: ${err.message}`, 'ERROR');
        log(`  Database path: ${dbPath}`, 'ERROR');
        log(`  Error code: ${err.code}`, 'ERROR');
      } else {
        log('✓ SQLite connection established', 'SUCCESS');
        // Check database and get record count
        db.get('SELECT COUNT(*) as count FROM bins', (err, row) => {
          if (err) {
            log(`✗ bins table not found: ${err.message}`, 'WARN');
            log(`  Database may need to be initialized with: npm run init-db`, 'INFO');
            dbReady = false;
          } else {
            const recordCount = row?.count || 0;
            log(`✓ Database loaded with ${recordCount.toLocaleString()} BIN records`, 'SUCCESS');
            dbReady = true;
          }
        });
      }
    });
  }).catch(err => {
    log(`✗ Failed to initialize database: ${err.message}`, 'ERROR');
    dbReady = false;
  });
}

app.use(express.static('public'));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} - Status: ${res.statusCode} (${duration}ms)`, 'INFO');
  });
  next();
});

app.post('/api/search', async (req, res) => {
  const startTime = Date.now();
  const { bin } = req.body;
  
  log(`Search request received: bin="${bin}"`, 'INFO');

  if (!bin) {
    log(`Search failed: no bin parameter provided`, 'WARN');
    return res.status(400).json({ error: 'bin parameter required' });
  }

  const searchBin = bin.toString().trim();
  const binLength = searchBin.length;

  log(`Validating BIN: "${searchBin}" (length: ${binLength})`, 'INFO');

  if (binLength < 6 || binLength > 11) {
    log(`Search rejected: invalid length ${binLength} (must be 6-11)`, 'WARN');
    return res.status(400).json({ 
      error: 'Your BIN should be 6-11 digits!',
      count: 0,
      matches: []
    });
  }

  try {
    log(`Starting database query for BIN prefix: "${searchBin}"`, 'INFO');
    const queryStart = Date.now();
    let matches = [];

    if (usePostgres && postgres) {
      log(`Using Postgres database`, 'INFO');
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
      log(`Using SQLite database`, 'INFO');
      // Query SQLite
      if (!db || !dbReady) {
        log(`Database not ready! db=${!!db}, dbReady=${dbReady}`, 'ERROR');
        return res.status(503).json({ error: 'Database not ready' });
      }

      matches = await new Promise((resolve, reject) => {
        db.all(
          'SELECT id, bin, card_brand, issuer, card_type, card_level, country_name, country_code_a2, country_code_a3, country_code_numeric, bank_website, bank_phone, pan_length, personal_commercial, regulated FROM bins WHERE bin LIKE ? LIMIT 100',
          [`${searchBin}%`],
          (err, rows) => {
            if (err) {
              log(`Database query error: ${err.message}`, 'ERROR');
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });
    }
    
    const queryDuration = Date.now() - queryStart;
    log(`Query completed in ${queryDuration}ms, found ${matches.length} matches`, 'SUCCESS');
    
    res.json({
      count: matches.length,
      matches: matches,
      searchedBin: searchBin,
      binLength: binLength
    });
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    log(`Search error after ${totalDuration}ms: ${err.message}`, 'ERROR');
    log(`Error stack: ${err.stack}`, 'DEBUG');
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  log('Health check requested', 'INFO');
  try {
    if (usePostgres && postgres) {
      log('Checking Postgres health...', 'INFO');
      const result = await postgres`SELECT COUNT(*) as count FROM bins`;
      const recordCount = result.rows[0]?.count || 0;
      log(`Health check OK - Postgres: ${recordCount.toLocaleString()} records`, 'SUCCESS');
      res.json({
        status: 'ok',
        database: 'postgres',
        ready: true,
        recordCount: recordCount
      });
    } else {
      const ready = dbReady && db !== null;
      log(`Health check - SQLite ready=${ready}, has db=${!!db}`, 'INFO');
      res.json({
        status: ready ? 'ok' : 'loading',
        database: 'sqlite',
        ready: ready,
        recordCount: 'check logs'
      });
    }
  } catch (err) {
    log(`Health check failed: ${err.message}`, 'ERROR');
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  log(`🚀 BIN Search server running at http://localhost:${PORT}`, 'SUCCESS');
});

// Debug endpoint to check files and system state
app.get('/api/debug/files', (req, res) => {
  log('Debug files endpoint called', 'INFO');
  const dataDir = path.join(__dirname, 'data');
  try {
    log(`Checking files in ${dataDir}`, 'INFO');
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
    
    // Check disk space of target location
    let diskInfo = null;
    if (process.env.DATABASE_PATH) {
      const dbDir = path.dirname(process.env.DATABASE_PATH);
      try {
        const stats = fs.statSync(dbDir);
        diskInfo = { path: dbDir, accessible: true };
      } catch (err) {
        diskInfo = { path: dbDir, accessible: false, error: err.message };
      }
    }
    
    log(`Debug info compiled: ${files.length} files, dbReady=${dbReady}`, 'INFO');
    res.json({
      dataDir: dataDir,
      files: fileInfo,
      dbReady: dbReady,
      db: db ? 'connected' : 'not connected',
      diskInfo: diskInfo,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_PATH: process.env.DATABASE_PATH,
        PORT: PORT,
        usePostgres: usePostgres
      }
    });
  } catch (err) {
    log(`Debug endpoint error: ${err.message}`, 'ERROR');
    res.status(500).json({
      error: err.message,
      dataDir: dataDir
    });
  }
});
