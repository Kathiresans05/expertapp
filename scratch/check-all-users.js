const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function main() {
  await client.connect();
  const users = await client.query('SELECT id, name, "mobileNumber", role, "createdAt" FROM users ORDER BY "createdAt" DESC');
  console.log('All Users in Database:');
  console.log(JSON.stringify(users.rows, null, 2));
  await client.end();
}

main().catch(console.error);
