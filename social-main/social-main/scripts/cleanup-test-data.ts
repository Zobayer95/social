import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const r = await prisma.user.deleteMany({
    where: { email: { contains: "@test.dev" } },
  });
  console.log("deleted test users:", r.count);
  await prisma.$disconnect();
}
main();
