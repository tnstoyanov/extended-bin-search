const { sql } = require('@vercel/postgres');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'bins.db');

async function importToPostgres() {
  if (!process.env.POSTGRES_PRISMA_URL && !process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_PRISMA_URL or POSTGRES_URL not set');
    console.error('Please set up Vercel Postgres connection string');
    process.exit(1);
  }

  try {
    console.log('Starting import to Vercel Postgres...');

    // Check if SQLite database exists
    if (!fs.existsSync(dbPath)) {
      console.error(`Error: SQLite database not found at ${dbPath}`);
      process.exit(1);
    }

    // Open SQLite connection
    const sqlite = new sqlite3.Database(dbPath);

    // Create table in Postgres
    console.log('Creating table in Postgres...');
    await sql`
      CREATE TABLE IF NOT EXISTS bins (
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
    `;
    console.log('✓ Table created');

    // Get total count from SQLite
    const { count } = await new Promise((resolve, reject) => {
      sqlite.get('SELECT COUNT(*) as count FROM bins', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log(`Total records to import: ${count.toLocaleString()}`);

    // Import in batches
    const batchSize = 100;
    let processed = 0;
    let imported = 0;

    const getAllRows = () => {
      return new Promise((resolve, reject) => {
        sqlite.all('SELECT * FROM bins', (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    };

    const rows = await getAllRows();
    console.log(`Retrieved ${rows.length} rows from SQLite`);

    // Insert in batches
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      for (const row of batch) {
        try {
          await sql`
            INSERT INTO bins (bin, card_brand, issuer, card_type, card_level, country_name, 
                             country_code_a2, country_code_a3, country_code_numeric, 
                             bank_website, bank_phone, pan_length, personal_commercial, regulated)
            VALUES (${row.bin}, ${row.card_brand}, ${row.issuer}, ${row.card_type}, 
                    ${row.card_level}, ${row.country_name}, ${row.country_code_a2}, 
                    ${row.country_code_a3}, ${row.country_code_numeric}, ${row.bank_website}, 
                    ${row.bank_phone}, ${row.pan_length}, ${row.personal_commercial}, ${row.regulated})
          `;
          imported++;
        } catch (err) {
          console.error(`Error inserting row ${i}: ${err.message}`);
        }
      }

      processed += batch.length;
      if (processed % 10000 === 0) {
        console.log(`Progress: ${processed}/${rows.length} rows processed, ${imported} imported`);
      }
    }

    // Create index
    console.log('Creating index...');
    await sql`CREATE INDEX IF NOT EXISTS idx_bins_prefix ON bins (bin)`;

    console.log(`\n✓ Import complete!`);
    console.log(`Total imported: ${imported}/${rows.length} records`);

    sqlite.close();
  } catch (err) {
    console.error('Import error:', err);
    process.exit(1);
  }
}

importToPostgres();
