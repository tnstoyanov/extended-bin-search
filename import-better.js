const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'bins.db');
const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

console.log('Starting optimized database import...');

const db = new sqlite3.Database(dbPath);

let lineCount = 0;
let insertCount = 0;
let batch = [];
const BATCH_SIZE = 5000;

db.serialize(() => {
  // Create table
  db.run(`CREATE TABLE bins (
    id INTEGER PRIMARY KEY,
    bin TEXT,
    card_brand TEXT,
    issuer TEXT,
    card_type TEXT,
    card_level TEXT,
    country_name TEXT,
    country_code_a2 TEXT,
    country_code_a3 TEXT,
    country_code_numeric TEXT,
    bank_website TEXT,
    bank_phone TEXT,
    pan_length TEXT,
    personal_commercial TEXT,
    regulated TEXT
  )`, () => {
    console.log('Created bins table\nStarting import...');
    readAndImport();
  });

  function readAndImport() {
    const rl = readline.createInterface({
      input: fs.createReadStream(csvPath),
      crlfDelay: Infinity,
      highWaterMark: 256 * 1024
    });

    rl.on('line', (line) => {
      lineCount++;
      const cols = line.split(';').map(c => c.trim());
      
      if (!cols[0]) return;
      
      batch.push(cols);
      
      if (batch.length >= BATCH_SIZE) {
        rl.pause();
        insertBatch(() => {
          rl.resume();
        });
      }

      if (lineCount % 200000 === 0) {
        console.log(`Progress: Read ${lineCount} lines, inserted ${insertCount}...`);
      }
    });

    rl.on('close', () => {
      if (batch.length > 0) {
        insertBatch(() => {
          finializeImport();
        });
      } else {
        finializeImport();
      }
    });
  }

  function insertBatch(callback) {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('BEGIN error:', err);
        return;
      }

      const stmt = db.prepare(`INSERT INTO bins VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      let processed = 0;
      batch.forEach(cols => {
        stmt.run(cols, (err) => {
          if (!err) insertCount++;
          else if (insertCount === 0) console.error('Insert error:', err);
          processed++;
        });
      });

      // Wait for all inserts to complete
      const checkComplete = () => {
        if (processed >= batch.length) {
          stmt.finalize(() => {
            db.run('COMMIT', (err) => {
              if (err) console.error('COMMIT error:', err);
              batch = [];
              if (callback) callback();
            });
          });
        } else {
          setImmediate(checkComplete);
        }
      };
      checkComplete();
    });
  }

  function finializeImport() {
    console.log(`\nFinishing import...`);
    console.log(`Read ${lineCount} total lines`);
    console.log(`Inserted ${insertCount} records`);

    db.run('CREATE INDEX idx_bins_prefix ON bins (bin)', (err) => {
      if (err) console.error('Index creation error:', err);
      else console.log('Created index');

      db.close((err) => {
        if (err) {
          console.error('Close error:', err);
          process.exit(1);
        }
        console.log('✓ Database initialization complete!');
        process.exit(0);
      });
    });
  }
});
