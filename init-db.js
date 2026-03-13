const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'bins.db');
const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

console.log('Starting database import...');

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Removed existing database');
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Set pragmas
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA cache_size = 10000');
  
  // Create table
  db.run(`CREATE TABLE IF NOT EXISTS bins (
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
  )`, (err) => {
    if (err) {
      console.error('Table creation error:', err);
      process.exit(1);
    }
    console.log('Created bins table');
    startImport();
  });
  
  function startImport() {
    let stmt = null;
    let insertCount = 0;
    let lineCount = 0;
    let batchCount = 0;
    const batchSize = 50000;
    let currentBatch = [];
    let inTransaction = false;

    const rl = readline.createInterface({
      input: fs.createReadStream(csvPath)
    });

    rl.on('line', (line) => {
      lineCount++;

      if (lineCount % 100000 === 0) {
        console.log(`Read ${lineCount} lines, inserted ${insertCount}...`);
      }

      const cols = line.split(';').map(c => c.trim());
      if (cols[0]) {
        currentBatch.push(cols);
        batchCount++;
        
        if (batchCount >= batchSize) {
          // Process batch
          if (!inTransaction) {
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) console.error('BEGIN error:', err);
            });
            inTransaction = true;
          }
          
          processBatch(currentBatch, insertCount, () => {
            insertCount += currentBatch.length;
            currentBatch = [];
            batchCount = 0;
            
            // Commit after batch
            db.run('COMMIT', (err) => {
              if (err) console.error('COMMIT error:', err);
              inTransaction = false;
            });
          });
        }
      }
    });

    rl.on('close', () => {
      // Process remaining batch
      if (currentBatch.length > 0) {
        if (!inTransaction) {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) console.error('BEGIN error:', err);
          });
        }
        processBatch(currentBatch, insertCount, () => {
          insertCount += currentBatch.length;
          
          db.run('COMMIT', (err) => {
            if (err) console.error('COMMIT error:', err);
            
            console.log(`Processed ${lineCount} lines`);
            console.log(`Inserted ${insertCount} records`);
            
            // Create index
            db.run('CREATE INDEX idx_bins_prefix ON bins (bin)', (err) => {
              if (err) {
                console.error('Index creation error:', err);
                process.exit(1);
              }
              console.log('Created index on bin column');
              
              db.close((err) => {
                if (err) {
                  console.error('Close error:', err);
                  process.exit(1);
                }
                console.log('Database ready!');
                process.exit(0);
              });
            });
          });
        });
      }
    });

    rl.on('error', (err) => {
      console.error('Read error:', err);
      db.close();
      process.exit(1);
    });

    function processBatch(batch, currentInserts, callback) {
      if (!stmt) {
        stmt = db.prepare(
          `INSERT INTO bins (bin, card_brand, issuer, card_type, card_level, 
                            country_name, country_code_a2, country_code_a3, country_code_numeric,
                            bank_website, bank_phone, pan_length, personal_commercial, regulated) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
      }

      let processed = 0;
      const processNext = () => {
        if (processed >= batch.length) {
          if (stmt) {
            stmt.finalize(() => {
              stmt = null;
              callback();
            });
          } else {
            callback();
          }
          return;
        }

        const cols = batch[processed];
        stmt.run(
          cols[0] || null,
          cols[1] || null,
          cols[2] || null,
          cols[3] || null,
          cols[4] || null,
          cols[5] || null,
          cols[6] || null,
          cols[7] || null,
          cols[8] || null,
          cols[9] || null,
          cols[10] || null,
          cols[11] || null,
          cols[12] || null,
          cols[13] || null,
          (err) => {
            if (err) {
              console.error('Insert error:', err, 'for BIN:', cols[0]);
              // Continue anyway
            }
            processed++;
            processNext();
          }
        );
      };

      processNext();
    }
  }
});
