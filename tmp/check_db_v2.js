
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function checkCollections() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const collections = await prisma.collection.findMany();
    console.log('Collections:', JSON.stringify(collections, null, 2));
  } catch (error) {
    console.error('Error fetching collections:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkCollections();
