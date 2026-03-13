const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const csvPath = path.join(__dirname, 'data', 'bins_all.csv');

console.log('Starting database import from CSV...');
console.log(`Using database: ${process.env.DATABASE_URL}`);

async function initializeDatabase() {
  let client = null;
  
  try {
    // Connect with retry logic - create fresh client for each attempt
    console.log('Connecting to database...');
    let connected = false;
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // Create a new client instance for this attempt - using simple config that works
        client = new Client(process.env.DATABASE_URL);
        
        console.log(`Connection attempt ${attempt}...`);
        await client.connect();
        connected = true;
        console.log('Connected successfully');
        break;
      } catch (err) {
        console.log(`Connection attempt ${attempt} failed:`, err.message);
        if (client) {
          try {
            await client.end();
          } catch (e) {}
          client = null;
        }
        if (attempt < 5) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    if (!connected || !client) {
      throw new Error('Failed to connect after 5 attempts');
    }

    // Drop existing table
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
    
    // Create index
    await client.query('CREATE INDEX idx_bins_prefix ON bins (bin)');
    
    console.log('Created bins table with indexes');

    // Read CSV and insert
    let insertCount = 0;
    let lineCount = 0;
    let batchCount = 0;
    const batchSize = 10;  // Very small batch for Neon free tier

    const rl = readline.createInterface({
      input: fs.createReadStream(csvPath)
    });

    let batch = [];
    let transactionActive = false;

    const processBatch = async () => {
      if (batch.length === 0) return;
      
      try {
        // Start transaction for this batch
        if (!transactionActive) {
          await client.query('BEGIN');
          transactionActive = true;
        }
        
        for (const cols of batch) {
          await client.query(
            `INSERT INTO bins (bin, card_brand, issuer, card_type, card_level, country_name, country_code_a2, country_code_a3, country_code_numeric, bank_website, bank_phone, pan_length, personal_commercial, regulated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
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
              cols[13] || null
            ]
          );
          insertCount++;
        }
        
        // Commit batch
        await client.query('COMMIT');
        transactionActive = false;
        batch = [];
      } catch (err) {
        if (transactionActive) {
          try {
            await client.query('ROLLBACK');
          } catch (e) {}
          transactionActive = false;
        }
        console.error('Batch error:', err.message);
        throw err;
      }
    };

    return new Promise((resolve, reject) => {
      rl.on('line', async (line) => {
        lineCount++;

        if (lineCount % 100000 === 0) {
          console.log(`Read ${lineCount} lines, inserted ${insertCount}...`);
        }

        const cols = line.split(';').map(c => c.trim());
        if (cols[0]) {
          batch.push(cols);
          batchCount++;
          
          if (batchCount >= batchSize) {
            rl.pause();
            processBatch()
              .then(() => {
                batchCount = 0;
                rl.resume();
              })
              .catch(reject);
          }
        }
      });

      rl.on('close', async () => {
        try {
          // Process remaining batch
          if (batch.length > 0) {
            await processBatch();
          }
          
          console.log(`Processed ${lineCount} lines`);
          console.log(`Inserted ${insertCount} records`);

          // Cleanup
          if (transactionActive) {
            try {
              await client.query('ROLLBACK');
            } catch (e) {}
          }
          await client.end();
          
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
    if (client) {
      try {
        await client.end();
      } catch (e) {}
    }
    process.exit(1);
  }
}

initializeDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
