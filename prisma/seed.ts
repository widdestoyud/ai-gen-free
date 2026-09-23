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
      isSpicy: false,
    },
    create: {
      mode: "t2i",
      modelId: "black-forest-labs/flux-1.1-pro-t2i",
      displayName: "Flux 1.1 Pro",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: false,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2i", modelId: "bytedance/seedream-5.0-pro-t2i-spicy" } },
    update: {
      displayName: "Seedream 5.0 Pro Spicy",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: true,
    },
    create: {
      mode: "t2i",
      modelId: "bytedance/seedream-5.0-pro-t2i-spicy",
      displayName: "Seedream 5.0 Pro Spicy",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: true,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "i2i", modelId: "alibaba/qwen-image-3-edit-spicy" } },
    update: {
      displayName: "Qwen Image 3 Edit Spicy",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: true,
    },
    create: {
      mode: "i2i",
      modelId: "alibaba/qwen-image-3-edit-spicy",
      displayName: "Qwen Image 3 Edit Spicy",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: true,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2i", modelId: "openai/gpt-image-2-t2i" } },
    update: {
      displayName: "GPT Image 2",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: false,
    },
    create: {
      mode: "t2i",
      modelId: "openai/gpt-image-2-t2i",
      displayName: "GPT Image 2",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: false,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "i2i", modelId: "openai/gpt-image-2-edit" } },
    update: {
      displayName: "GPT Image 2 Edit",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: false,
    },
    create: {
      mode: "i2i",
      modelId: "openai/gpt-image-2-edit",
      displayName: "GPT Image 2 Edit",
      providerId: "siray",
      costPoints: 10,
      enabled: true,
      isSpicy: false,
    },
  });

  const DEFAULT_VIDEO_CONFIG_POINTS = {
    "6s_480p": 100,
    "6s_720p": 210,
    "6s_1080p": 500,
    "10s_480p": 155,
    "10s_720p": 345,
    "10s_1080p": 820,
    "15s_480p": 235,
    "15s_720p": 510,
    "15s_1080p": 1230,
  };

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "i2v", modelId: "bytedance/seedance-2.5-i2v" } },
    update: {
      displayName: "Seedance 2.5 I2V",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: false,
    },
    create: {
      mode: "i2v",
      modelId: "bytedance/seedance-2.5-i2v",
      displayName: "Seedance 2.5 I2V",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: false,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "i2v", modelId: "bytedance/seedance-2.0-i2v-spicy" } },
    update: {
      displayName: "Seedance 2.0 I2V Spicy",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
    create: {
      mode: "i2v",
      modelId: "bytedance/seedance-2.0-i2v-spicy",
      displayName: "Seedance 2.0 I2V Spicy",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "i2v", modelId: "bytedance/seedance-2.5-i2v-spicy" } },
    update: {
      displayName: "Seedance 2.5 I2V Spicy",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
    create: {
      mode: "i2v",
      modelId: "bytedance/seedance-2.5-i2v-spicy",
      displayName: "Seedance 2.5 I2V Spicy",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "i2v", modelId: "alibaba/wan-2.7-i2v-uncensored" } },
    update: {
      displayName: "Wan 2.7 I2V Uncensored",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
    create: {
      mode: "i2v",
      modelId: "alibaba/wan-2.7-i2v-uncensored",
      displayName: "Wan 2.7 I2V Uncensored",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
  });

  // T2V Video Models (Text-to-Video)
  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2v", modelId: "bytedance/seedance-2.5-i2v" } },
    update: {
      displayName: "Seedance 2.5",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: false,
    },
    create: {
      mode: "t2v",
      modelId: "bytedance/seedance-2.5-i2v",
      displayName: "Seedance 2.5",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: false,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2v", modelId: "bytedance/seedance-2.0-i2v-spicy" } },
    update: {
      displayName: "Seedance 2.0 Spicy",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
    create: {
      mode: "t2v",
      modelId: "bytedance/seedance-2.0-i2v-spicy",
      displayName: "Seedance 2.0 Spicy",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2v", modelId: "bytedance/seedance-2.5-i2v-spicy" } },
    update: {
      displayName: "Seedance 2.5 Spicy",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
    create: {
      mode: "t2v",
      modelId: "bytedance/seedance-2.5-i2v-spicy",
      displayName: "Seedance 2.5 Spicy",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
  });

  await prisma.modelCatalog.upsert({
    where: { mode_modelId: { mode: "t2v", modelId: "alibaba/wan-2.7-i2v-uncensored" } },
    update: {
      displayName: "Wan 2.7 Uncensored",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
    },
    create: {
      mode: "t2v",
      modelId: "alibaba/wan-2.7-i2v-uncensored",
      displayName: "Wan 2.7 Uncensored",
      providerId: "siray",
      costPoints: 100,
      videoConfigPoints: DEFAULT_VIDEO_CONFIG_POINTS,
      enabled: true,
      isSpicy: true,
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
