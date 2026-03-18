import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0])
  return new PrismaClient({ adapter })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = (process.env.NODE_ENV === 'production') 
  ? prismaClientSingleton()
  : (globalThis.prisma ?? prismaClientSingleton())

// Force refresh in dev to pick up schema changes without restarting server
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export default prisma
