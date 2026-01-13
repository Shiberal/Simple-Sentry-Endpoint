import { PrismaClient } from '../generated/prisma';

let prisma;

// Prisma 7 automatically reads the connection URL from prisma.config.ts or DATABASE_URL env var
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default prisma;

