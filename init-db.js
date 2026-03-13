const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'data', 'bins.db');
const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

console.log('Starting database import...');

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
  });

  let stmt;
  let insertCount = 0;
  let lineCount = 0;
  let batchCount = 0;
  let commitHandled = false;
  const batchSize = 50000;

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath)
  });

  const insertRow = (cols) => {
    if (!stmt) {
      stmt = db.prepare(
        `INSERT INTO bins (bin, card_brand, issuer, card_type, card_level, 
                          country_name, country_code_a2, country_code_a3, country_code_numeric,
                          bank_website, bank_phone, pan_length, personal_commercial, regulated) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
    }
    
    stmt.run(
      cols[0] || null,      // bin
      cols[1] || null,      // card_brand
      cols[2] || null,      // issuer
      cols[3] || null,      // card_type
      cols[4] || null,      // card_level
      cols[5] || null,      // country_name
      cols[6] || null,      // country_code_a2
      cols[7] || null,      // country_code_a3
      cols[8] || null,      // country_code_numeric
      cols[9] || null,      // bank_website
      cols[10] || null,     // bank_phone
      cols[11] || null,     // pan_length
      cols[12] || null,     // personal_commercial
      cols[13] || null      // regulated
    );
    insertCount++;
    batchCount++;
  };

  rl.on('line', (line) => {
    lineCount++;

    if (lineCount % 100000 === 0) {
      console.log(`Read ${lineCount} lines, inserted ${insertCount}...`);
    }

    const cols = line.split(';').map(c => c.trim());
    if (cols[0]) {
      insertRow(cols);
    }
  });

  rl.on('close', () => {
    if (stmt) stmt.finalize();
    
    console.log(`Processed ${lineCount} lines`);
    console.log(`Inserted ${insertCount} records`);
    
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
