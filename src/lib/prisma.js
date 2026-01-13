import { PrismaClient } from '../generated/prisma';

let prisma;

// Prisma 7 requires passing the connection URL to the constructor
const prismaOptions = process.env.DATABASE_URL
  ? {
      datasourceUrl: process.env.DATABASE_URL,
    }
  : {};

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(prismaOptions);
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient(prismaOptions);
  }
  prisma = global.prisma;
}

export default prisma;

