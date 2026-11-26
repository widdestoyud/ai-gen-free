import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import {
  TEMPLATE_KEY_RE,
  TEMPLATE_MODEL_IDS,
  parseAdminListQuery,
  parseCustomerListQuery,
  parseTemplateInput,
} from "./parse.js";

function isValidation(err: unknown): boolean {
  return err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR;
}

const validCover = { key: "templates/abc123.webp", width: 768, height: 1024 };
const validImage = { key: "templates/ref001.webp", alias: "face_1", width: 512, height: 512 };
const validBase = {
  title: " Cafe ",
  prompt: "girl in cafe",
  aspectRatio: "9:16",
  cover: validCover,
  images: [],
};

test("TEMPLATE_KEY_RE matches templates/<alnum>.webp only", () => {
  assert.equal(TEMPLATE_KEY_RE.test("templates/abc123.webp"), true);
  assert.equal(TEMPLATE_KEY_RE.test("templates/ABC123.webp"), false);
  assert.equal(TEMPLATE_KEY_RE.test("templates/abc-123.webp"), false);
  assert.equal(TEMPLATE_KEY_RE.test("templates/abc123.png"), false);
  assert.equal(TEMPLATE_KEY_RE.test("uploads/customer/u1/abc123.webp"), false);
});

test("TEMPLATE_MODEL_IDS exposes abstract IDs only", () => {
  assert.deepEqual([...TEMPLATE_MODEL_IDS], ["t2i-standard", "t2i-spicy", "i2i-standard", "i2i-spicy"]);
});

test("parseTemplateInput accepts valid text-only template", () => {
  const out = parseTemplateInput(validBase);
  assert.equal(out.title, "Cafe");
  assert.equal(out.prompt, "girl in cafe");
  assert.equal(out.category, null);
  assert.equal(out.modelId, null);
  assert.equal(out.aspectRatio, "9:16");
  assert.equal(out.isSpicy, false);
  assert.equal(out.isActive, true);
  assert.equal(out.sortOrder, 0);
  assert.deepEqual(out.cover, validCover);
  assert.deepEqual(out.images, []);
});

test("parseTemplateInput accepts full template with 4 reference images and all valid ratios/models", () => {
  const ratios = ["1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3"];
  for (const aspectRatio of ratios) {
    const out = parseTemplateInput({ ...validBase, aspectRatio });
    assert.equal(out.aspectRatio, aspectRatio);
  }
  for (const modelId of TEMPLATE_MODEL_IDS) {
    const out = parseTemplateInput({ ...validBase, modelId });
    assert.equal(out.modelId, modelId);
  }
  const out = parseTemplateInput({
    title: "Editorial Portrait",
    prompt: "editorial portrait in studio lighting",
    category: "  Portrait  ",
    modelId: "i2i-spicy",
    aspectRatio: "3:4",
    isSpicy: true,
    isActive: false,
    sortOrder: -5,
    cover: validCover,
    images: [
      validImage,
      { key: "templates/ref002.webp", alias: null, width: 640, height: 640 },
      { key: "templates/ref003.webp", alias: "", width: 640, height: 640 },
      { key: "templates/ref004.webp", width: 640, height: 640 },
    ],
  });
  assert.equal(out.category, "Portrait");
  assert.equal(out.isSpicy, true);
  assert.equal(out.isActive, false);
  assert.equal(out.sortOrder, -5);
  assert.equal(out.images.length, 4);
  assert.equal(out.images[0]?.alias, "face_1");
  assert.equal(out.images[1]?.alias, null);
  assert.equal(out.images[2]?.alias, null);
  assert.equal(out.images[3]?.alias, null);
});

test("parseTemplateInput rejects non-object and invalid title/prompt/category", () => {
  assert.throws(() => parseTemplateInput(null), isValidation);
  assert.throws(() => parseTemplateInput([]), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, title: "   " }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, title: "a".repeat(121) }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, prompt: "  " }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, prompt: "p".repeat(4001) }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, category: "c".repeat(41) }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, category: 123 }), isValidation);
});

test("parseTemplateInput rejects key outside templates/", () => {
  assert.throws(
    () => parseTemplateInput({ ...validBase, cover: { key: "uploads/customer/u1/x.webp", width: 1, height: 1 } }),
    isValidation,
  );
  assert.throws(
    () => parseTemplateInput({ ...validBase, images: [{ key: "templates/../outputs/u1/a.webp", width: 1, height: 1 }] }),
    isValidation,
  );
  assert.throws(
    () => parseTemplateInput({ ...validBase, cover: { key: "templates/ABC.webp", width: 1, height: 1 } }),
    isValidation,
  );
  assert.throws(() => parseTemplateInput({ ...validBase, cover: null }), isValidation);
  assert.throws(
    () => parseTemplateInput({ ...validBase, cover: { key: "templates/abc123.webp", width: -1, height: 100 } }),
    isValidation,
  );
  assert.throws(
    () => parseTemplateInput({ ...validBase, cover: { key: "templates/abc123.webp", width: 100.5, height: 100 } }),
    isValidation,
  );
});

test("parseTemplateInput rejects >4 images, bad alias, bad ratio, raw model name, bad sortOrder", () => {
  assert.throws(() => parseTemplateInput({ ...validBase, images: Array(5).fill(validImage) }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, images: "not-array" }), isValidation);
  assert.throws(
    () => parseTemplateInput({ ...validBase, images: [{ ...validImage, alias: "bad-alias" }] }),
    isValidation,
  );
  assert.throws(
    () => parseTemplateInput({ ...validBase, images: [{ ...validImage, alias: "a".repeat(25) }] }),
    isValidation,
  );
  assert.throws(() => parseTemplateInput({ ...validBase, aspectRatio: "21:9" }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, modelId: "black-forest-labs/flux-1.1-pro" }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, sortOrder: 1.5 }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, sortOrder: "1" }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, isSpicy: "true" }), isValidation);
  assert.throws(() => parseTemplateInput({ ...validBase, isActive: 1 }), isValidation);
});

test("parseCustomerListQuery defaults, trims, and caps", () => {
  assert.deepEqual(parseCustomerListQuery({}), {
    page: 1,
    limit: 12,
    q: null,
    category: null,
    sort: "default",
    spicy: false,
  });
  assert.equal(parseCustomerListQuery({ limit: "500" }).limit, 24);
  assert.equal(parseCustomerListQuery({ limit: "0" }).limit, 1);
  assert.equal(parseCustomerListQuery({ page: "0" }).page, 1);
  assert.equal(parseCustomerListQuery({ page: "3", limit: "18" }).page, 3);
  assert.equal(parseCustomerListQuery({ page: "3", limit: "18" }).limit, 18);
  assert.equal(parseCustomerListQuery({ spicy: "1" }).spicy, true);
  assert.equal(parseCustomerListQuery({ spicy: "0" }).spicy, false);
  assert.equal(parseCustomerListQuery({ spicy: "true" }).spicy, false);
  assert.equal(parseCustomerListQuery({ q: "   " }).q, null);
  assert.equal(parseCustomerListQuery({ q: `  ${"x".repeat(120)}  ` }).q?.length, 100);
  assert.equal(parseCustomerListQuery({ category: "  Anime  " }).category, "Anime");
  assert.equal(parseCustomerListQuery({ sort: "trending" }).sort, "trending");
  assert.equal(parseCustomerListQuery({ sort: "newest" }).sort, "newest");
  assert.equal(parseCustomerListQuery({ sort: "invalid" }).sort, "default");
});

test("parseAdminListQuery defaults and sorting rules", () => {
  assert.deepEqual(parseAdminListQuery({}), {
    page: 1,
    limit: 20,
    q: null,
    category: null,
    isSpicy: null,
    isActive: null,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const q = parseAdminListQuery({ isActive: "false", sortBy: "title" });
  assert.equal(q.limit, 20);
  assert.equal(q.isActive, false);
  assert.equal(q.sortBy, "title");
  assert.equal(q.sortOrder, "asc");

  assert.equal(parseAdminListQuery({ sortBy: "sortOrder" }).sortOrder, "asc");
  assert.equal(parseAdminListQuery({ sortBy: "usageCount" }).sortOrder, "desc");
  assert.equal(parseAdminListQuery({ sortBy: "title", sortOrder: "desc" }).sortOrder, "desc");
  assert.equal(parseAdminListQuery({ sortBy: "createdAt", sortOrder: "asc" }).sortOrder, "asc");
  assert.equal(parseAdminListQuery({ limit: "250" }).limit, 100);
  assert.equal(parseAdminListQuery({ isSpicy: "1", isActive: "true" }).isSpicy, true);
  assert.equal(parseAdminListQuery({ isSpicy: "1", isActive: "true" }).isActive, true);
  assert.equal(parseAdminListQuery({ isSpicy: "all" }).isSpicy, null);
});
