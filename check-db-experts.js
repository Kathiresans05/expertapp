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
  console.log('Connected to DB');
  const res = await client.query(`
    SELECT ep.id as profile_id, ep."isApproved", ep."isOnline", u.id as user_id, u.name, u."mobileNumber" 
    FROM expert_profiles ep 
    JOIN "users" u ON ep."userId" = u.id
  `);
  console.log('Experts in PostgreSQL:');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
