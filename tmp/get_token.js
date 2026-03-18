
const { PrismaClient } = require('@prisma/client');
const { pg } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new pg.Pool({ connectionString: "postgresql://postgres:postgres@localhost:54322/postgres" });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
    try {
        const page = await prisma.facebookPage.findFirst();
        console.log("Current Token in DB:", page?.accessToken);
        console.log("Page Name:", page?.pageName);
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
