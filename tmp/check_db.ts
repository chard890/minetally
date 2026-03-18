
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function checkCollections() {
  try {
    const collections = await prisma.collection.findMany();
    console.log('Collections:', JSON.stringify(collections, null, 2));
  } catch (error) {
    console.error('Error fetching collections:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCollections();
