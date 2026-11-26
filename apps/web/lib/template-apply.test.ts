import assert from "node:assert/strict";
import { test } from "node:test";
import {
  needsOverwriteConfirm,
  templateToStudioRefs,
  type ComposerSnapshot,
  type CustomerTemplate,
} from "./template-apply";
import { queryKeys } from "./query-keys";

const tplFixture: CustomerTemplate = {
  id: "tpl_1",
  title: "Cafe Portrait",
  prompt: "woman in sunlit cafe, @hero holding coffee",
  category: "Portrait",
  modelId: "i2i-standard",
  aspectRatio: "3:4",
  isSpicy: false,
  coverUrl: "https://cdn.test/cover.webp",
  images: [
    {
      id: "cmu1efgfz0001qz0zntv0iy2z",
      url: "https://cdn.test/ref1.webp",
      alias: "hero",
      width: 768,
      height: 1024,
    },
    {
      id: "cmu1efgfz0002qz0zntv0iy3a",
      url: "https://cdn.test/ref2.webp",
      alias: null,
      width: 1024,
      height: 1024,
    },
    {
      id: "cmu1efgfz0003qz0zntv0iy4b",
      url: "https://cdn.test/ref3.webp",
      alias: "  ",
      width: 512,
      height: 512,
    },
  ],
};

test("needsOverwriteConfirm: empty composer needs no confirm", () => {
  assert.equal(needsOverwriteConfirm({ prompt: "", refIds: [] }, null), false);
  assert.equal(needsOverwriteConfirm({ prompt: "   \n\t ", refIds: [] }, null), false);
  assert.equal(
    needsOverwriteConfirm({ prompt: "  ", refIds: [] }, { prompt: "prev", refIds: ["tpl-1"] }),
    false,
  );
});

test("needsOverwriteConfirm: typed prompt or manual upload needs confirm", () => {
  assert.equal(needsOverwriteConfirm({ prompt: "hi", refIds: [] }, null), true);
  assert.equal(needsOverwriteConfirm({ prompt: "", refIds: ["up1"] }, null), true);
  assert.equal(needsOverwriteConfirm({ prompt: "   ", refIds: ["up1"] }, null), true);
});

test("needsOverwriteConfirm: untouched applied template needs no confirm", () => {
  const applied: ComposerSnapshot = { prompt: "cafe girl", refIds: ["tpl-1", "tpl-2"] };
  assert.equal(needsOverwriteConfirm({ prompt: "cafe girl", refIds: ["tpl-1", "tpl-2"] }, applied), false);
});

test("needsOverwriteConfirm: edited applied template needs confirm", () => {
  const applied: ComposerSnapshot = { prompt: "cafe girl", refIds: ["tpl-1", "tpl-2"] };
  assert.equal(
    needsOverwriteConfirm({ prompt: "cafe girl, red dress", refIds: ["tpl-1", "tpl-2"] }, applied),
    true,
  );
  assert.equal(
    needsOverwriteConfirm({ prompt: "cafe girl", refIds: ["tpl-1", "tpl-2", "up9"] }, applied),
    true,
  );
  assert.equal(needsOverwriteConfirm({ prompt: "cafe girl", refIds: ["tpl-1"] }, applied), true);
  assert.equal(needsOverwriteConfirm({ prompt: "cafe girl", refIds: [] }, applied), true);
  assert.equal(
    needsOverwriteConfirm({ prompt: "cafe girl", refIds: ["tpl-2", "tpl-1"] }, applied),
    true,
  );
});

test("templateToStudioRefs builds template submit refs and resequences tags", () => {
  const refs = templateToStudioRefs(tplFixture);
  assert.equal(refs.length, 3);

  assert.deepEqual(refs[0], {
    id: "tpl-cmu1efgfz0001qz0zntv0iy2z",
    url: "https://cdn.test/ref1.webp",
    kind: "template",
    submitUrl: "template-image:cmu1efgfz0001qz0zntv0iy2z",
    alias: "hero",
    width: 768,
    height: 1024,
    tag: "@hero",
  });

  assert.equal(refs[1].id, "tpl-cmu1efgfz0002qz0zntv0iy3a");
  assert.equal(refs[1].kind, "template");
  assert.equal(refs[1].submitUrl, "template-image:cmu1efgfz0002qz0zntv0iy3a");
  assert.equal(refs[1].tag, "@image1");

  assert.equal(refs[2].id, "tpl-cmu1efgfz0003qz0zntv0iy4b");
  assert.equal(refs[2].tag, "@image2");
});

test("templateToStudioRefs handles template without images", () => {
  const refs = templateToStudioRefs({ ...tplFixture, images: [] });
  assert.deepEqual(refs, []);
});

test("queryKeys includes templates, templateCategories, and adminTemplates", () => {
  assert.deepEqual(
    queryKeys.templates({ q: "cafe", category: "Portrait", sort: "trending", spicy: false }),
    ["templates", { q: "cafe", category: "Portrait", sort: "trending", spicy: false }],
  );
  assert.deepEqual(queryKeys.templateCategories(true), ["template-categories", { spicy: true }]);
  assert.deepEqual(queryKeys.adminTemplates({ page: 1, limit: 20 }), [
    "admin-templates",
    { page: 1, limit: 20 },
  ]);
  assert.deepEqual(queryKeys.adminTemplates(), ["admin-templates", undefined]);
});
