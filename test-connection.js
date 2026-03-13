const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  console.log('Testing Neon connection...');
  console.log(`Connection string: ${process.env.DATABASE_URL}`);
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      ca: undefined,
      cert: undefined,
      key: undefined
    },
    connectionTimeoutMillis: 30000,
    idle_in_transaction_session_timeout: 60000
  });

  try {
    console.log('\nAttempting connection with detailed logging...');
    
    client.on('error', (err) => {
      console.error('Client error event:', err);
    });
    
    client.on('end', () => {
      console.log('Client connection ended');
    });

    // Try to connect
    console.log('Calling client.connect()...');
    await client.connect();
    
    console.log('\nConnection successful!');
    
    // Test a simple query
    console.log('\nTesting simple query...');
    const result = await client.query('SELECT NOW()');
    console.log('Query result:', result.rows[0]);
    
    // Check if bins table exists
    console.log('\nChecking if bins table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bins'
      )
    `);
    console.log('Bins table exists:', tableCheck.rows[0].exists);
    
    console.log('\nConnection test passed!');
    await client.end();
    process.exit(0);
    
  } catch (err) {
    console.error('\nConnection failed:');
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    console.error('Error details:', err);
    
    try {
      await client.end();
    } catch (e) {}
    
    process.exit(1);
  }
}

testConnection();
