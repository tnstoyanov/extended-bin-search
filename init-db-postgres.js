const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

console.log('Starting database import from CSV...');
console.log(`Using database: ${process.env.DATABASE_URL}`);

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Drop existing table if it exists
    console.log('Preparing database...');
    await client.query('DROP TABLE IF EXISTS bins CASCADE');
    
    // Create table
    await client.query(`
      CREATE TABLE bins (
        id SERIAL PRIMARY KEY,
        bin VARCHAR(11) NOT NULL,
        card_brand VARCHAR(255),
        issuer VARCHAR(255),
        card_type VARCHAR(255),
        card_level VARCHAR(255),
        country_name VARCHAR(255),
        country_code_a2 VARCHAR(2),
        country_code_a3 VARCHAR(3),
        country_code_numeric VARCHAR(3),
        bank_website VARCHAR(255),
        bank_phone VARCHAR(255),
        pan_length VARCHAR(255),
        personal_commercial VARCHAR(255),
        regulated VARCHAR(255)
      )
    `);
    
    // Create index on bin column for faster searches
    await client.query('CREATE INDEX idx_bins_prefix ON bins (bin)');
    
    console.log('Created bins table with indexes');

    // Read CSV and insert with batch processing
    let insertCount = 0;
    let lineCount = 0;
    const batchSize = 1000;
    let batch = [];

    const rl = readline.createInterface({
      input: fs.createReadStream(csvPath)
    });

    const flushBatch = async () => {
      if (batch.length === 0) return;

      try {
        // Build multi-row INSERT statement
        const values = batch.map((cols, idx) => {
          const offset = idx * 14;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`;
        }).join(',');

        const flatValues = batch.flat();

        const query = `
          INSERT INTO bins (bin, card_brand, issuer, card_type, card_level, country_name, country_code_a2, country_code_a3, country_code_numeric, bank_website, bank_phone, pan_length, personal_commercial, regulated)
          VALUES ${values}
        `;

        await client.query(query, flatValues);
        insertCount += batch.length;
        batch = [];
      } catch (err) {
        console.error('Batch insert error:', err.message);
        throw err;
      }
    };

    return new Promise((resolve, reject) => {
      rl.on('line', (line) => {
        lineCount++;

        if (lineCount % 100000 === 0) {
          console.log(`Read ${lineCount} lines, inserted ${insertCount}...`);
        }

        const cols = line.split(';').map(c => c.trim());
        if (cols[0]) {
          batch.push([
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
          ]);

          if (batch.length >= batchSize) {
            rl.pause();
            flushBatch().then(() => rl.resume()).catch(reject);
          }
        }
      });

      rl.on('close', async () => {
        try {
          // Flush remaining batch
          await flushBatch();
          
          console.log(`Processed ${lineCount} lines`);
          console.log(`Inserted ${insertCount} records`);

          client.release();
          await pool.end();
          
          console.log('Database initialization complete!');
          process.exit(0);
        } catch (err) {
          console.error('Error on close:', err);
          reject(err);
        }
      });

      rl.on('error', (err) => {
        console.error('Read error:', err);
        reject(err);
      });
    });
  } catch (err) {
    console.error('Initialization error:', err);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

initializeDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
