const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'bins.db');

async function importToNeon() {
  // Use unpooled connection for large imports
  const pgUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  
  if (!pgUrl) {
    console.error('Error: Database URL not set');
    process.exit(1);
  }

  if (!fs.existsSync(dbPath)) {
    console.error(`Error: SQLite database not found at ${dbPath}`);
    process.exit(1);
  }

  // Create pool with very long timeouts and single connection
  const pool = new Pool({ 
    connectionString: pgUrl,
    statement_timeout: 300000,
    query_timeout: 300000,
    max: 1,
    idleTimeoutMillis: 300000,
    connectionTimeoutMillis: 30000,
  });

  const client = await pool.connect();

  try {
    console.log('Connected to Neon Postgres');
    await client.query('SET idle_in_transaction_session_timeout = 0');

    // Drop existing table if exists
    await client.query('DROP TABLE IF EXISTS bins');
    console.log('Dropped existing bins table');

    // Create table
    await client.query(`
      CREATE TABLE bins (
        id SERIAL PRIMARY KEY,
        bin VARCHAR(11),
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
    console.log('✓ Created bins table');

    // Get data from SQLite
    const sqlite = new sqlite3.Database(dbPath);
    
    let totalRows = 0;
    let batchCount = 0;
    const BATCH_SIZE = 25;
    let batch = [];

    await new Promise((resolve, reject) => {
      sqlite.all('SELECT * FROM bins ORDER BY id', async (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`Total rows to import: ${rows.length}`);

        for (const row of rows) {
          batch.push([
            row.bin,
            row.card_brand,
            row.issuer,
            row.card_type,
            row.card_level,
            row.country_name,
            row.country_code_a2,
            row.country_code_a3,
            row.country_code_numeric,
            row.bank_website,
            row.bank_phone,
            row.pan_length,
            row.personal_commercial,
            row.regulated
          ]);

          if (batch.length >= BATCH_SIZE) {
            try {
              await insertBatch(client, batch, totalRows);
              totalRows += batch.length;
              batchCount++;
              
              if (batchCount % 40 === 0) {
                console.log(`Progress: Inserted ${totalRows} rows...`);
              }
              
              batch = [];
              await new Promise(r => setTimeout(r, 10));
            } catch (err) {
              console.error(`Error inserting batch at row ${totalRows}: ${err.message}`);
              reject(err);
              return;
            }
          }
        }

        // Insert remaining batch
        if (batch.length > 0) {
          try {
            await insertBatch(client, batch, totalRows);
            totalRows += batch.length;
          } catch (err) {
            console.error(`Error inserting final batch: ${err.message}`);
            reject(err);
            return;
          }
        }

        console.log(`\n✓ Import complete: ${totalRows} records inserted`);
        
        // Create index
        console.log('Creating index...');
        await client.query('CREATE INDEX idx_bins_prefix ON bins (bin)');
        console.log('✓ Created index on bin column');

        sqlite.close();
        resolve();
      });
    });

    console.log('✓ Successfully imported all data to Neon');
    process.exit(0);

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertBatch(client, batch) {
  if (batch.length === 0) return;

  const values = batch
    .map((row, i) => {
      const paramStart = (i * 14) + 1;
      return `(${Array.from({length: 14}, (_, j) => `$${paramStart + j}`).join(',')})`;
    })
    .join(',');

  const query = `
    INSERT INTO bins (
      bin, card_brand, issuer, card_type, card_level, country_name,
      country_code_a2, country_code_a3, country_code_numeric,
      bank_website, bank_phone, pan_length, personal_commercial, regulated
    ) VALUES ${values}
  `;

  const flatParams = batch.flat();
  await client.query(query, flatParams);
}

importToNeon().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
