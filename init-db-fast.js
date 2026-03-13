const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'bins.db');
const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

console.log('Starting database import...');

// Remove existing database
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Removed existing database');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database error:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  // Create simple table first
  db.run(`CREATE TABLE IF NOT EXISTS bins (
    id INTEGER PRIMARY KEY,
    bin TEXT,
    bank_name TEXT,
    card_brand TEXT,
    card_type TEXT,
    country TEXT,
    country_code TEXT
  )`, (err) => {
    if (err) console.error('Table creation error:', err);
    else console.log('Created bins table');
  });

  let stmt;
  let batchCount = 0;
  let totalLines = 0;
  let skipped = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath)
  });

  const insertRow = (cols) => {
    if (!stmt) {
      stmt = db.prepare(
        `INSERT INTO bins (bin, bank_name, card_brand, card_type, country, country_code) 
         VALUES (?, ?, ?, ?, ?, ?)`
      );
    }
    
    stmt.run(
      cols[0] || null,
      cols[1] || null,
      cols[2] || null,
      cols[3] || null,
      cols[4] || null,
      cols[5] || null,
      (err) => {
        if (err && err.code !== 'SQLITE_CONSTRAINT') {
          console.error('Insert error:', err);
        }
        batchCount++;
      }
    );
  };

  rl.on('line', (line) => {
    totalLines++;
    if (totalLines % 10000 === 0) {
      console.log(`Read ${totalLines} lines, inserted ${batchCount}...`);
    }

    const cols = line.split(';').map(c => c.trim());
    if (cols[0]) {
      insertRow(cols);
    } else {
      skipped++;
    }
  });

  rl.on('close', () => {
    if (stmt) stmt.finalize();
    console.log(`Processed ${totalLines} lines`);
    console.log(`Inserted ${batchCount} records`);
    console.log(`Skipped ${skipped} empty rows`);
    
    db.close((err) => {
      if (err) {
        console.error('Close error:', err);
        process.exit(1);
      }
      console.log('Database ready!');
      process.exit(0);
    });
  });

  rl.on('error', (err) => {
    console.error('Read error:', err);
    if (stmt) stmt.finalize();
    db.close();
    process.exit(1);
  });
});
