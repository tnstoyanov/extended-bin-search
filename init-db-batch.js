const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'bins.db');
const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath);

// Create table
db.serialize(() => {
  db.run(`CREATE TABLE bins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin TEXT NOT NULL UNIQUE,
    bank_name TEXT,
    card_brand TEXT,
    card_type TEXT,
    country TEXT,
    country_code TEXT
  )`);

  // Batch insert
  const batchSize = 500;
  let batch = [];
  let totalInserted = 0;
  let totalSkipped = 0;
  let lineCount = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath)
  });

  const flushBatch = () => {
    if (batch.length === 0) return;

    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
    const values = batch.flat();

    db.run(
      `INSERT OR IGNORE INTO bins (bin, bank_name, card_brand, card_type, country, country_code, extra) 
       VALUES ${placeholders}`,
      values,
      function(err) {
        if (!err) {
          totalInserted += this.changes;
        }
      }
    );
    batch = [];
  };

  rl.on('line', (line) => {
    lineCount++;
    if (lineCount % 10000 === 0) {
      console.log(`Processed ${lineCount} lines...`);
    }

    const cols = line.split(';');
    if (cols[0] && cols[0].trim()) {
      batch.push([
        cols[0].trim(),
        cols[1] ? cols[1].trim() : null,
        cols[2] ? cols[2].trim() : null,
        cols[3] ? cols[3].trim() : null,
        cols[4] ? cols[4].trim() : null,
        cols[5] ? cols[5].trim() : null,
        cols.slice(6).join(';').trim() || null
      ]);

      if (batch.length >= batchSize) {
        flushBatch();
      }
    }
  });

  rl.on('close', () => {
    flushBatch();
    console.log(`Done! Imported ${totalInserted} records`);
    db.close();
  });

  rl.on('error', (err) => {
    console.error('Error:', err);
    db.close();
    process.exit(1);
  });
});
