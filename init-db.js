const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

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

// Read all lines first
fs.readFile(csvPath, 'utf8', (err, data) => {
  if (err) {
    console.error('File read error:', err);
    process.exit(1);
  }

  const lines = data.split('\n').filter(line => line.trim());
  console.log(`Total lines in CSV: ${lines.length}`);

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

      // Prepare statement
      const stmt = db.prepare(`INSERT INTO bins VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      let insertCount = 0;
      let errorCount = 0;

      // Begin transaction
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('BEGIN error:', err);
          process.exit(1);
        }

        // Insert all rows
        lines.forEach((line, idx) => {
          if (!line.trim()) return;

          const cols = line.split(';').map(c => c.trim());

          if (!cols[0]) return;

          stmt.run(...cols, (err) => {
            if (err && errorCount < 5) {
              console.error(`Insert error on line ${idx + 1}:`, err);
              errorCount++;
            }
            if (!err) {
              insertCount++;
            }
          });

          if ((idx + 1) % 100000 === 0) {
            console.log(`Processed ${idx + 1} lines...`);
          }
        });

        // Finalize statement and commit
        stmt.finalize((err) => {
          if (err) {
            console.error('Finalize error:', err);
            process.exit(1);
          }

          db.run('COMMIT', (err) => {
            if (err) {
              console.error('COMMIT error:', err);
              process.exit(1);
            }
            
            console.log(`Inserted ${insertCount} records`);

            // Create index
            db.run('CREATE INDEX idx_bins_prefix ON bins (bin)', (err) => {
              if (err) {
                console.error('Index creation error:', err);
                process.exit(1);
              }
              console.log('Created index on bin column');

              // Verify count
              db.get('SELECT COUNT(*) as count FROM bins', (err, row) => {
                if (err) {
                  console.error('Count error:', err);
                } else {
                  console.log(`Database now contains ${row.count} records`);
                }

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
        });
      });
    });
  });
});
