const API = "http://localhost:3001";
const MAIL = "http://localhost:8025";
const BASIC = "Basic " + Buffer.from("admin:change-me").toString("base64");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const results = [];

function record(name, pass, evidence) {
  results.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}  ${evidence}`);
}

function cookieFrom(res, name) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const m = c.match(new RegExp(`${name}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function latestOtp(email) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAIL}/api/v1/messages`)).json();
    const msg = (list.messages ?? []).find((m) =>
      JSON.stringify(m.To ?? m.to ?? []).includes(email.split("@")[0]),
    );
    if (msg) {
      const full = await (await fetch(`${MAIL}/api/v1/message/${msg.ID}`)).json();
      const text = full.Text ?? full.text ?? "";
      const m = String(text).match(/(\d{6})/);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("OTP not found for " + email);
}

async function loginUser(email) {
  await fetch(`${API}/api/auth/otp/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const code = await latestOtp(email);
  const res = await fetch(`${API}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const body = await json(res);
  const sid = cookieFrom(res, "sid");
  if (!res.ok || !sid) throw new Error("login user failed " + JSON.stringify(body));
  return sid;
}

async function loginAdmin() {
  const email = "you@example.com";
  await fetch(`${API}/api/admin/auth/otp/request`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: BASIC },
    body: JSON.stringify({ email }),
  });
  const code = await latestOtp(email);
  const res = await fetch(`${API}/api/admin/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: BASIC },
    body: JSON.stringify({ email, code }),
  });
  const body = await json(res);
  const sid = cookieFrom(res, "sid_admin");
  if (!res.ok || !sid) throw new Error("login admin failed " + JSON.stringify(body));
  return sid;
}

function userHeaders(sid, extra = {}) {
  return { cookie: `sid=${sid}`, "content-type": "application/json", ...extra };
}

async function topup(sid, adminSid, packageId = "p20") {
  const inv = await json(
    await fetch(`${API}/api/invoices`, {
      method: "POST",
      headers: userHeaders(sid),
      body: JSON.stringify({ packageId }),
    }),
  );
  const form = new FormData();
  form.set("file", new Blob([PNG], { type: "image/png" }), "bukti.png");
  await fetch(`${API}/api/invoices/${inv.id}/proof`, {
    method: "POST",
    headers: { cookie: `sid=${sid}` },
    body: form,
  });
  await fetch(`${API}/api/admin/invoices/${inv.id}/approve`, {
    method: "POST",
    headers: {
      cookie: `sid_admin=${adminSid}`,
      authorization: BASIC,
      "content-type": "application/json",
    },
    body: "{}",
  });
}

async function postJob(sid, body, key) {
  return fetch(`${API}/api/jobs`, {
    method: "POST",
    headers: userHeaders(sid, { "Idempotency-Key": key }),
    body: JSON.stringify(body),
  });
}

async function waitJob(sid, id, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${API}/api/jobs/${id}`, { headers: userHeaders(sid) });
    const body = await json(res);
    if (body.status === "succeeded" || body.status === "failed") return body;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("timeout waiting job " + id);
}

const stamp = Date.now();
const emailA = `m4a${stamp}@example.com`;
const emailB = `m4b${stamp}@example.com`;

const sidA = await loginUser(emailA);
const sidB = await loginUser(emailB);
const sidAdmin = await loginAdmin();

const catalog = await json(await fetch(`${API}/api/catalog/generate`, { headers: userHeaders(sidA) }));
const models = catalog.models ?? [];
const siray = models.find((m) => m.providerId === "siray" && m.mode === "t2i");
const dummyOn = models.some((m) => m.modelId === "dummy-t2i");
record(
  "Katalog t2i Siray enabled, dummy off",
  Boolean(siray?.modelId === "black-forest-labs/flux-1.1-pro-t2i" && siray.costPoints === 10 && siray.displayName) &&
    !dummyOn,
  JSON.stringify(models),
);

const nonT2i = await postJob(sidA, { mode: "t2v", prompt: "video" }, `k-t2v-${stamp}`);
const nonT2iBody = await json(nonT2i);
record(
  "Mode non-t2i VALIDATION_ERROR",
  nonT2i.status === 400 && nonT2iBody.error?.code === "VALIDATION_ERROR",
  `${nonT2i.status} ${JSON.stringify(nonT2iBody.error)}`,
);

const dummyModel = await postJob(
  sidA,
  { mode: "t2i", modelId: "dummy-t2i", prompt: "dummy" },
  `k-dummy-${stamp}`,
);
const dummyBody = await json(dummyModel);
record(
  "dummy-t2i disabled VALIDATION_ERROR",
  dummyModel.status === 400 && dummyBody.error?.code === "VALIDATION_ERROR",
  `${dummyModel.status} ${JSON.stringify(dummyBody.error)}`,
);

await topup(sidA, sidAdmin);
await topup(sidB, sidAdmin);
const walletA0 = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));

const fakeCost = await postJob(
  sidA,
  {
    mode: "t2i",
    modelId: "black-forest-labs/flux-1.1-pro-t2i",
    prompt: "token kosong / gagal worker",
    cost: 999,
    providerId: "dummy",
  },
  `k-fail-${stamp}`,
);
const fakeAccepted = await json(fakeCost);
record(
  "POST 202, cost klien diabaikan",
  fakeCost.status === 202 && fakeAccepted.cost_held === 10 && Boolean(fakeAccepted.job_id),
  `${fakeCost.status} ${JSON.stringify(fakeAccepted)}`,
);

const failed = await waitJob(sidA, fakeAccepted.job_id);
const walletAfterFail = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));
record(
  "Gagal: release tanpa cooldown",
  failed.status === "failed" &&
    walletAfterFail.available === walletA0.available &&
    !failed.nextGenerateAt &&
    (failed.errorCode === "PROVIDER_NOT_CONFIGURED" ||
      failed.errorCode === "PROVIDER_UNAVAILABLE" ||
      failed.errorCode === "PROVIDER_ERROR"),
  `status=${failed.status} error=${failed.errorCode} available=${walletAfterFail.available} next=${failed.nextGenerateAt}`,
);

const bSeesA = await fetch(`${API}/api/jobs/${fakeAccepted.job_id}`, { headers: userHeaders(sidB) });
record("User B GET job A = 404", bSeesA.status === 404, `status=${bSeesA.status}`);

const key1 = `k-race1-${stamp}`;
const key2 = `k-race2-${stamp}`;
const body = { mode: "t2i", prompt: "race tab", cost: 1 };
const [r1, r2] = await Promise.all([postJob(sidB, body, key1), postJob(sidB, body, key2)]);
const b1 = await json(r1);
const b2 = await json(r2);
const codes = [r1.status, r2.status].sort();
record(
  "Dua tab: satu 202 satu 409 JOB_IN_PROGRESS",
  codes[0] === 202 && codes[1] === 409 && [b1.error?.code, b2.error?.code].includes("JOB_IN_PROGRESS"),
  `status=${r1.status}/${r2.status} ${JSON.stringify(b1.error ?? b1)} ${JSON.stringify(b2.error ?? b2)}`,
);

const replay = await postJob(sidA, { mode: "t2i", prompt: "token kosong / gagal worker" }, `k-fail-${stamp}`);
const replayBody = await json(replay);
record(
  "Idempotency-Key replay",
  replay.status === 202 && replayBody.job_id === fakeAccepted.job_id,
  `${replay.status} ${replayBody.job_id}`,
);

const failed2 = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed2.length}/${results.length} pass`);
if (failed2.length) process.exit(1);
