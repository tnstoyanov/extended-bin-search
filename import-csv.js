const better_sqlite3 = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'bins.db');
const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

console.log('Starting synchronous database import...');

// Remove existing database
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new better_sqlite3(dbPath);

// Enable performance settings
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 50000');
db.pragma('temp_store = MEMORY');

// Create table
db.exec(`CREATE TABLE bins (
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
)`);
console.log('Created bins table');

const insert = db.prepare(`INSERT INTO bins VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

let lineCount = 0;
let insertCount = 0;
const BATCH_SIZE = 5000;
let batch = [];

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
    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        try {
          insert.run(row);
          insertCount++;
        } catch (e) {
          if (insertCount === 0) console.error('Insert failed:', e);
        }
      }
    });
    transaction(batch);
    batch = [];
  }

  if (lineCount % 100000 === 0) {
    console.log(`Progress: Read ${lineCount} lines, inserted ${insertCount}...`);
  }
});

rl.on('close', () => {
  // Insert remaining batch
  if (batch.length > 0) {
    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        try {
          insert.run(row);
          insertCount++;
        } catch (e) {
          if (insertCount < 5) console.error('Insert failed:', e);
        }
      }
    });
    transaction(batch);
  }

  console.log(`\nFinishing import...`);
  console.log(`Read ${lineCount} total lines`);
  console.log(`Inserted ${insertCount} records`);

  // Create index
  db.exec('CREATE INDEX idx_bins_prefix ON bins (bin)');
  console.log('Created index on bin column');

  db.close();
  console.log('✓ Database import complete!');
  process.exit(0);
});
