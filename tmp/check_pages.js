
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function checkPages() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const pages = await prisma.facebookPage.findMany();
    console.log('Pages:', JSON.stringify(pages, null, 2));
  } catch (error) {
    console.error('Error fetching pages:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkPages();
