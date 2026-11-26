import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl";

const adapter = new PrismaPg({ connectionString: resolveDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

// The current shop locations stock gets sent out to — a starting point for the
// admin-managed Shop list, editable afterward via the Shops admin page.
const STARTER_SHOPS = ["MT-G", "Puff", "Ipswich"];

async function seedAdminUser() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) {
    console.log("SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD not set — skipping user seed.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { username: username.toLowerCase() },
    update: { passwordHash, role: "ADMIN" },
    create: { username: username.toLowerCase(), passwordHash, role: "ADMIN" },
  });
  console.log(`Seeded user "${user.username}" (role: ${user.role}).`);
}

async function seedShops() {
  const existingCount = await prisma.shop.count();
  if (existingCount > 0) {
    console.log("Shops already exist — skipping starter shop seed.");
    return;
  }

  for (let i = 0; i < STARTER_SHOPS.length; i++) {
    await prisma.shop.create({ data: { name: STARTER_SHOPS[i]!, sortOrder: i } });
  }
  console.log(`Seeded starter shops: ${STARTER_SHOPS.join(", ")}.`);
}

async function main() {
  await seedAdminUser();
  await seedShops();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
