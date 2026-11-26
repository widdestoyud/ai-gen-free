import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import sharp from "sharp";
import { AppError, ErrorCodes, isSafePublicUrl, type ObjectStorage } from "@ai-gen-free/core";
import {
  createTemplateService,
  diffRemovedKeys,
  resolveSpicyScope,
  toCustomerView,
  toPage,
} from "./service.js";
import { registerTemplateRoutes } from "../routes/templates.js";

function createMemoryStorage() {
  const store = new Map<string, { body: Uint8Array; contentType: string }>();
  const deleted: string[] = [];
  let failDelete = false;
  const storage: ObjectStorage & {
    _store: typeof store;
    _deleted: typeof deleted;
    _setFailDelete: (v: boolean) => void;
  } = {
    driver: "memory",
    async put(input) {
      store.set(input.key, { body: input.body, contentType: input.contentType });
    },
    async get(key) {
      const item = store.get(key);
      if (!item) throw new Error(`Not found: ${key}`);
      return { key, ...item };
    },
    async delete(key) {
      if (failDelete) throw new Error("R2 delete timeout");
      deleted.push(key);
      store.delete(key);
    },
    async signGetUrl(key, expiresSeconds = 3600) {
      return `https://cdn.test/signed/${encodeURIComponent(key.split("/")[1] ?? key)}?exp=${expiresSeconds}`;
    },
    _store: store,
    _deleted: deleted,
    _setFailDelete(v: boolean) {
      failDelete = v;
    },
  };
  return storage;
}

type FakeTemplateRecord = {
  id: string;
  title: string;
  prompt: string;
  category: string | null;
  modelId: string | null;
  aspectRatio: string;
  isSpicy: boolean;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  coverStorageKey: string;
  coverWidth: number;
  coverHeight: number;
  createdAt: Date;
  updatedAt: Date;
  images: Array<{
    id: string;
    templateId: string;
    storageKey: string;
    alias: string | null;
    position: number;
    width: number;
    height: number;
    createdAt: Date;
  }>;
};

function createFakeDb(seed?: {
  users?: Array<{ id: string; spicyModeEnabled: boolean }>;
  templates?: FakeTemplateRecord[];
}) {
  const users = new Map<string, { id: string; spicyModeEnabled: boolean }>();
  for (const u of seed?.users ?? []) users.set(u.id, u);

  const templates = new Map<string, FakeTemplateRecord>();
  for (const t of seed?.templates ?? []) templates.set(t.id, t);

  const auditLogs: Array<{ actorId: string | null; action: string; target: string | null; ip?: string | null; meta: unknown }> = [];
  let seq = 1;

  const db = {
    user: {
      async findUnique({ where }: any) {
        return users.get(where.id) ?? null;
      },
    },
    template: {
      async count({ where }: any) {
        return filterTemplates([...templates.values()], where).length;
      },
      async findMany({ where, orderBy, skip = 0, take, distinct }: any) {
        let rows = filterTemplates([...templates.values()], where);
        rows = sortTemplates(rows, orderBy);
        if (Array.isArray(distinct) && distinct.includes("category")) {
          const seen = new Set<string | null>();
          rows = rows.filter((r) => {
            if (seen.has(r.category)) return false;
            seen.add(r.category);
            return true;
          });
        }
        const sliced = typeof take === "number" ? rows.slice(skip, skip + take) : rows.slice(skip);
        return sliced.map((r) => ({ ...r, images: [...r.images] }));
      },
      async findUnique({ where }: any) {
        const found = templates.get(where.id);
        return found ? { ...found, images: [...found.images] } : null;
      },
      async create({ data }: any) {
        const id = `ctpl${String(seq++).padStart(21, "0")}`;
        const now = new Date();
        const imgs = (data.images?.create ?? []).map((img: any, idx: number) => ({
          id: `cimg${String(seq++).padStart(21, "0")}`,
          templateId: id,
          storageKey: img.storageKey,
          alias: img.alias ?? null,
          position: img.position ?? idx,
          width: img.width ?? 0,
          height: img.height ?? 0,
          createdAt: now,
        }));
        const rec: FakeTemplateRecord = {
          id,
          title: data.title,
          prompt: data.prompt,
          category: data.category ?? null,
          modelId: data.modelId ?? null,
          aspectRatio: data.aspectRatio ?? "1:1",
          isSpicy: Boolean(data.isSpicy),
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
          usageCount: 0,
          coverStorageKey: data.coverStorageKey,
          coverWidth: data.coverWidth ?? 0,
          coverHeight: data.coverHeight ?? 0,
          createdAt: now,
          updatedAt: now,
          images: imgs,
        };
        templates.set(id, rec);
        return { ...rec, images: [...rec.images] };
      },
      async update({ where, data }: any) {
        const cur = templates.get(where.id);
        if (!cur) throw new Error("Record not found");
        const now = new Date();
        const nextImgs = Array.isArray(data.images?.create)
          ? data.images.create.map((img: any, idx: number) => ({
              id: `cimg${String(seq++).padStart(21, "0")}`,
              templateId: cur.id,
              storageKey: img.storageKey,
              alias: img.alias ?? null,
              position: img.position ?? idx,
              width: img.width ?? 0,
              height: img.height ?? 0,
              createdAt: now,
            }))
          : cur.images;
        const next: FakeTemplateRecord = {
          ...cur,
          title: data.title ?? cur.title,
          prompt: data.prompt ?? cur.prompt,
          category: data.category !== undefined ? data.category : cur.category,
          modelId: data.modelId !== undefined ? data.modelId : cur.modelId,
          aspectRatio: data.aspectRatio ?? cur.aspectRatio,
          isSpicy: data.isSpicy ?? cur.isSpicy,
          isActive: data.isActive ?? cur.isActive,
          sortOrder: data.sortOrder ?? cur.sortOrder,
          coverStorageKey: data.coverStorageKey ?? cur.coverStorageKey,
          coverWidth: data.coverWidth ?? cur.coverWidth,
          coverHeight: data.coverHeight ?? cur.coverHeight,
          updatedAt: now,
          images: nextImgs,
        };
        templates.set(cur.id, next);
        return { ...next, images: [...next.images] };
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const rec of templates.values()) {
          if (where.id && rec.id !== where.id) continue;
          if (where.isActive !== undefined && rec.isActive !== where.isActive) continue;
          if (where.isSpicy !== undefined && rec.isSpicy !== where.isSpicy) continue;
          if (data.usageCount?.increment) {
            rec.usageCount += data.usageCount.increment;
          }
          count++;
        }
        return { count };
      },
      async delete({ where }: any) {
        const cur = templates.get(where.id);
        if (!cur) throw new Error("Record not found");
        templates.delete(where.id);
        return cur;
      },
    },
    auditLog: {
      async create({ data }: any) {
        auditLogs.push(data);
        return data;
      },
    },
    async $transaction(fn: (tx: any) => Promise<any>) {
      return fn(db);
    },
    _auditLogs: auditLogs,
    _templates: templates,
  };
  return db;
}

function filterTemplates(rows: FakeTemplateRecord[], where: any = {}) {
  return rows.filter((r) => {
    if (where.isActive !== undefined && r.isActive !== where.isActive) return false;
    if (where.isSpicy !== undefined && r.isSpicy !== where.isSpicy) return false;
    if (where.category !== undefined) {
      if (typeof where.category === "object" && where.category !== null && "not" in where.category) {
        if (r.category === where.category.not) return false;
      } else if (r.category !== where.category) {
        return false;
      }
    }
    if (Array.isArray(where.OR)) {
      const needle = String(where.OR[0]?.title?.contains ?? "").toLowerCase();
      if (needle && !r.title.toLowerCase().includes(needle) && !r.prompt.toLowerCase().includes(needle)) {
        return false;
      }
    }
    return true;
  });
}

function sortTemplates(rows: FakeTemplateRecord[], orderBy: any) {
  const list = [...rows];
  const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  list.sort((a, b) => {
    for (const clause of clauses) {
      const [field, dir] = Object.entries(clause)[0] as [keyof FakeTemplateRecord, "asc" | "desc"];
      const av = a[field] as any;
      const bv = b[field] as any;
      const cmp =
        av instanceof Date && bv instanceof Date
          ? av.getTime() - bv.getTime()
          : typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av ?? "").localeCompare(String(bv ?? ""));
      if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return list;
}

const rowFixture: FakeTemplateRecord = {
  id: "tpl_001",
  title: "Cafe Portrait",
  prompt: "warm cinematic portrait in coffee shop",
  category: "Portrait",
  modelId: "i2i-standard",
  aspectRatio: "3:4",
  isSpicy: false,
  isActive: true,
  sortOrder: 1,
  usageCount: 15,
  coverStorageKey: "templates/cover001.webp",
  coverWidth: 768,
  coverHeight: 1024,
  createdAt: new Date("2026-11-26T00:00:00.000Z"),
  updatedAt: new Date("2026-11-26T00:00:00.000Z"),
  images: [
    {
      id: "cimg000000000000000000002",
      templateId: "tpl_001",
      storageKey: "templates/ref002.webp",
      alias: "outfit",
      position: 1,
      width: 512,
      height: 512,
      createdAt: new Date("2026-11-26T00:00:00.000Z"),
    },
    {
      id: "cimg000000000000000000001",
      templateId: "tpl_001",
      storageKey: "templates/ref001.webp",
      alias: "face",
      position: 0,
      width: 512,
      height: 768,
      createdAt: new Date("2026-11-26T00:00:00.000Z"),
    },
  ],
};

test("diffRemovedKeys returns keys no longer referenced", () => {
  assert.deepEqual(
    diffRemovedKeys(
      ["templates/a.webp", "templates/b.webp", "templates/a.webp"],
      ["templates/b.webp", "templates/c.webp"],
    ),
    ["templates/a.webp"],
  );
  assert.deepEqual(diffRemovedKeys(["templates/a.webp"], ["templates/a.webp"]), []);
});

test("resolveSpicyScope gates spicy with A031 / 403", () => {
  assert.equal(resolveSpicyScope(false, false), false);
  assert.equal(resolveSpicyScope(false, true), false);
  assert.equal(resolveSpicyScope(true, true), true);
  assert.throws(
    () => resolveSpicyScope(true, false),
    (err: unknown) =>
      err instanceof AppError &&
      err.code === ErrorCodes.SPICY_MODE_REQUIRED &&
      err.status === 403,
  );
});

test("toPage: exactly limit rows means no more", () => {
  assert.deepEqual(toPage([1, 2, 3], 3), { items: [1, 2, 3], hasMore: false });
  assert.deepEqual(toPage([1, 2, 3, 4], 3), { items: [1, 2, 3], hasMore: true });
  assert.deepEqual(toPage([], 12), { items: [], hasMore: false });
});

test("toCustomerView never leaks storage keys and orders images by position", async () => {
  const v = await toCustomerView(rowFixture, async (k) => `https://cdn.test/${k.split("/")[1]}`);
  assert.ok(!JSON.stringify(v).includes("templates/"));
  assert.equal(v.images.length, rowFixture.images.length);
  assert.equal(v.images[0]?.alias, "face");
  assert.equal(v.images[1]?.alias, "outfit");
  assert.equal(v.coverUrl, "https://cdn.test/cover001.webp");
  assert.equal(v.modelId, "i2i-standard");
});

test("isSafePublicUrl blocks SSRF targets and allows public HTTPS URLs", () => {
  for (const u of [
    "http://localhost/a.png",
    "http://127.0.0.1/evil",
    "http://[::1]/evil",
    "http://169.254.169.254/x",
    "http://10.0.0.5/a",
    "http://172.16.0.1/a",
    "http://192.168.1.10/a",
    "http://0.0.0.0/a",
    "http://api:4000/x",
    "http://redis:6379/x",
    "file:///etc/passwd",
  ]) {
    assert.equal(isSafePublicUrl(u), false, `Expected ${u} to be blocked`);
  }
  assert.equal(isSafePublicUrl("https://images.example.com/a.png"), true);
});

test("uploadAsset compresses buffer to templates/<cuid>.webp and enforces SSRF on sourceUrl", async () => {
  const storage = createMemoryStorage();
  const pngBuffer = await sharp({
    create: { width: 64, height: 96, channels: 3, background: { r: 120, g: 40, b: 200 } },
  })
    .png()
    .toBuffer();

  let fetchCalled = false;
  const service = createTemplateService({
    storage,
    db: createFakeDb() as any,
    fetchImpl: async () => {
      fetchCalled = true;
      return new Response(pngBuffer, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    },
  });

  // SSRF sourceUrl must be rejected before calling fetch
  await assert.rejects(
    () => service.uploadAsset({ sourceUrl: "http://169.254.169.254/latest/meta-data/" }),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
  assert.equal(fetchCalled, false);

  // Buffer upload
  const uploaded = await service.uploadAsset({ buffer: pngBuffer, contentType: "image/png" });
  assert.match(uploaded.key, /^templates\/[a-z0-9]+\.webp$/);
  assert.equal(uploaded.width, 64);
  assert.equal(uploaded.height, 96);
  assert.ok(storage._store.has(uploaded.key));

  // Public sourceUrl upload
  const imported = await service.uploadAsset({ sourceUrl: "https://images.example.com/sample.png" });
  assert.equal(fetchCalled, true);
  assert.match(imported.key, /^templates\/[a-z0-9]+\.webp$/);
  assert.equal(imported.width, 64);
  assert.equal(imported.height, 96);
});

test("uploadAsset blocks SSRF redirect target from public URL", async () => {
  const storage = createMemoryStorage();
  const service = createTemplateService({
    storage,
    db: createFakeDb() as any,
    fetchImpl: async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1:4000/admin/me" },
      }),
  });

  await assert.rejects(
    () => service.uploadAsset({ sourceUrl: "https://images.example.com/redirect" }),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
});

test("adminCreate, adminUpdate, and adminDelete clean up removed R2 assets and write AuditLog", async () => {
  const storage = createMemoryStorage();
  await storage.put({ key: "templates/oldcover.webp", body: new Uint8Array([1]), contentType: "image/webp" });
  await storage.put({ key: "templates/oldref.webp", body: new Uint8Array([1]), contentType: "image/webp" });
  await storage.put({ key: "templates/keptref.webp", body: new Uint8Array([1]), contentType: "image/webp" });

  const db = createFakeDb();
  const service = createTemplateService({ storage, db: db as any });

  const created = await service.adminCreate("admin-1", {
    title: "Studio Look",
    prompt: "editorial portrait",
    category: "Portrait",
    modelId: "i2i-standard",
    aspectRatio: "3:4",
    isSpicy: false,
    isActive: true,
    sortOrder: 1,
    cover: { key: "templates/oldcover.webp", width: 768, height: 1024 },
    images: [
      { key: "templates/oldref.webp", alias: "face", width: 512, height: 512 },
      { key: "templates/keptref.webp", alias: "pose", width: 512, height: 512 },
    ],
  });

  assert.equal(created.cover.key, "templates/oldcover.webp");
  assert.equal(db._auditLogs[0]?.action, "template.create");

  await storage.put({ key: "templates/newcover.webp", body: new Uint8Array([1]), contentType: "image/webp" });
  const updated = await service.adminUpdate("admin-1", created.id, {
    title: "Studio Look v2",
    prompt: "editorial portrait v2",
    category: "Portrait",
    modelId: "i2i-standard",
    aspectRatio: "3:4",
    isSpicy: false,
    isActive: true,
    sortOrder: 2,
    cover: { key: "templates/newcover.webp", width: 768, height: 1024 },
    images: [{ key: "templates/keptref.webp", alias: "pose", width: 512, height: 512 }],
  });

  assert.equal(updated.title, "Studio Look v2");
  assert.deepEqual(storage._deleted.sort(), ["templates/oldcover.webp", "templates/oldref.webp"]);
  assert.ok(storage._store.has("templates/keptref.webp"));
  assert.ok(storage._store.has("templates/newcover.webp"));
  assert.equal(db._auditLogs[1]?.action, "template.update");

  // Delete fails best-effort without throwing
  storage._setFailDelete(true);
  const delRes = await service.adminDelete("admin-1", created.id);
  assert.equal(delRes.ok, true);
  assert.equal(db._auditLogs[2]?.action, "template.delete");
});

test("customerList, customerCategories, and recordUse enforce active & spicy gates", async () => {
  const storage = createMemoryStorage();
  const db = createFakeDb({
    users: [
      { id: "u-safe", spicyModeEnabled: false },
      { id: "u-spicy", spicyModeEnabled: true },
    ],
    templates: [
      { ...rowFixture, id: "t-safe-1", title: "Alpha", category: "Studio", isSpicy: false, isActive: true, sortOrder: 2, usageCount: 5 },
      { ...rowFixture, id: "t-safe-2", title: "Beta", category: "Anime", isSpicy: false, isActive: true, sortOrder: 1, usageCount: 20 },
      { ...rowFixture, id: "t-inactive", title: "Hidden", category: "Hidden", isSpicy: false, isActive: false },
      { ...rowFixture, id: "t-spicy-1", title: "SpicyOne", category: "Glamour", isSpicy: true, isActive: true },
    ],
  });
  const service = createTemplateService({ storage, db: db as any });

  // Non-spicy user cannot list spicy templates
  await assert.rejects(
    () =>
      service.customerList("u-safe", {
        page: 1,
        limit: 12,
        q: null,
        category: null,
        sort: "default",
        spicy: true,
      }),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.SPICY_MODE_REQUIRED && err.status === 403,
  );

  // Default sort (sortOrder asc) returns active safe items only
  const safeList = await service.customerList("u-safe", {
    page: 1,
    limit: 1,
    q: null,
    category: null,
    sort: "default",
    spicy: false,
  });
  assert.equal(safeList.hasMore, true);
  assert.equal(safeList.items.length, 1);
  assert.equal(safeList.items[0]?.id, "t-safe-2");

  // Categories are distinct, active, alphabetically sorted
  const cats = await service.customerCategories("u-safe", false);
  assert.deepEqual(cats.categories, ["Anime", "Studio"]);

  // recordUse rejects inactive and unauthorized spicy with 404
  await assert.rejects(
    () => service.recordUse("u-safe", "t-inactive"),
    (err: unknown) => err instanceof AppError && err.status === 404,
  );
  await assert.rejects(
    () => service.recordUse("u-safe", "t-spicy-1"),
    (err: unknown) => err instanceof AppError && err.status === 404,
  );

  // Authorized user increments usageCount
  const used = await service.recordUse("u-spicy", "t-spicy-1");
  assert.deepEqual(used, { ok: true });
  assert.equal(db._templates.get("t-spicy-1")?.usageCount, 16);
});

test("template routes reject unauthenticated requests with 401 A006", async () => {
  const app = Fastify();
  await app.register(cookie);
  const storage = createMemoryStorage();
  await registerTemplateRoutes(app, { storage });

  for (const [method, url] of [
    ["GET", "/customer/templates"],
    ["GET", "/customer/templates/categories"],
    ["POST", "/customer/templates/tpl_1/use"],
    ["GET", "/customer/templates/images/img_1/file"],
    ["GET", "/admin/templates"],
    ["POST", "/admin/templates"],
    ["POST", "/admin/templates/assets"],
    ["GET", "/admin/templates/tpl_1"],
    ["PATCH", "/admin/templates/tpl_1"],
    ["DELETE", "/admin/templates/tpl_1"],
  ] as const) {
    const res = await app.inject({ method, url });
    assert.equal(res.statusCode, 401, `${method} ${url} should return 401`);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, ErrorCodes.UNAUTHENTICATED);
  }
});
