import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSetting.upsert({
    where: { key: "generate_cooldown_seconds" },
    update: {},
    create: { key: "generate_cooldown_seconds", value: 43200 },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2i", modelId: "black-forest-labs/flux-1.1-pro-t2i" } },
    update: {
      displayName: "Flux 1.1 Pro",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
    },
    create: {
      mode: "t2i",
      modelId: "black-forest-labs/flux-1.1-pro-t2i",
      displayName: "Flux 1.1 Pro",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
    },
  });

  const dummyEnabled = process.env.ENABLE_DUMMY_T2I === "true";
  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2i", modelId: "dummy-t2i" } },
    update: {
      displayName: "Dummy",
      providerId: "dummy",
      costPoints: 10,
      enabled: dummyEnabled,
    },
    create: {
      mode: "t2i",
      modelId: "dummy-t2i",
      displayName: "Dummy",
      providerId: "dummy",
      costPoints: 10,
      enabled: dummyEnabled,
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
