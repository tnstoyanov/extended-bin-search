const pg = require('pg');
require('dotenv').config();

async function test() {
  console.log('Raw connection string:', process.env.DATABASE_URL);
  
  const client = new pg.Client(process.env.DATABASE_URL);
  
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✓ Connection successful!');
    
    const result = await client.query('SELECT NOW()');
    console.log('✓ Query successful:', result.rows[0]);
    
    await client.end();
  } catch (err) {
    console.error('✗ Connection failed');
    console.error('Error:', err.message);
    console.error('Code:', err.code);
  }
}

test();
