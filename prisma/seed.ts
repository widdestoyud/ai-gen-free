import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSetting.upsert({
    where: { key: "generate_cooldown_seconds" },
    update: {},
    create: { key: "generate_cooldown_seconds", value: 43200 },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2i", modelId: "dummy-t2i" } },
    update: { providerId: "dummy", costPoints: 10, enabled: true },
    create: {
      mode: "t2i",
      modelId: "dummy-t2i",
      providerId: "dummy",
      costPoints: 10,
      enabled: true,
    },
  });

  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  for (const email of emails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "admin", emailVerifiedAt: new Date() },
      create: { email, role: "admin", emailVerifiedAt: new Date() },
    });
    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
