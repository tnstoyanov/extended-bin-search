const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'bins.db');
const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

console.log('Starting database import...');
console.log(`DB: ${dbPath}`);
console.log(`CSV: ${csvPath}`);

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Removed existing database');
}

const db = new sqlite3.Database(dbPath);

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
  )`, (err) => {
    if (err) {
      console.error('Table creation error:', err);
      process.exit(1);
    }
    console.log('Created bins table');
    readAndImport();
  });

  function readAndImport() {
    let lineCount = 0;
    let insertCount = 0;
    let stmt = null;

    const rl = readline.createInterface({
      input: fs.createReadStream(csvPath),
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      lineCount++;
      
      if (lineCount % 100000 === 0) {
        console.log(`Progress: Read ${lineCount} lines, inserted ${insertCount}...`);
      }

      // Parse CSV line
      const cols = line.split(';').map(c => c.trim());
      
      // Skip empty lines
      if (!cols[0]) return;

      // Prepare statement on first use
      if (!stmt) {
        stmt = db.prepare(`INSERT INTO bins VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      }

      // Insert row
      stmt.run(cols, (err) => {
        if (err && lineCount < 10) {
          console.error(`Insert error on line ${lineCount}:`, err, cols);
        }
        if (!err) {
          insertCount++;
        }
      });
    });

    rl.on('close', () => {
      console.log(`\nFinishing import...`);
      console.log(`Read ${lineCount} total lines`);
      console.log(`Inserted ${insertCount} records`);

      // Finalize prepared statement
      if (stmt) {
        stmt.finalize((err) => {
          if (err) console.error('Finalize error:', err);

          // Create index
          db.run('CREATE INDEX idx_bins_prefix ON bins (bin)', (err) => {
            if (err) {
              console.error('Index creation error:', err);
            } else {
              console.log('Created index');
            }

            // Close database
            db.close((err) => {
              if (err) {
                console.error('Close error:', err);
                process.exit(1);
              }
              console.log('✓ Database initialization complete!');
              process.exit(0);
            });
          });
        });
      } else {
        db.close((err) => {
          if (err) {
            console.error('Close error:', err);
            process.exit(1);
          }
          console.log('✓ Database ready!');
          process.exit(0);
        });
      }
    });

    rl.on('error', (err) => {
      console.error('Read error:', err);
      if (stmt) stmt.finalize();
      db.close();
      process.exit(1);
    });
  }
});
