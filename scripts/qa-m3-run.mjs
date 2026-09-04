const API = "http://localhost:3001";
const WEB = "http://localhost:3000";
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

async function waitJob(sid, id, timeoutMs = 15000) {
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
const emailA = `m3a${stamp}@example.com`;
const emailB = `m3b${stamp}@example.com`;

const sidA = await loginUser(emailA);
const sidB = await loginUser(emailB);
const sidAdmin = await loginAdmin();

const noPoints = await postJob(sidA, { mode: "t2i", prompt: "tanpa poin" }, `k-nopoints-${stamp}`);
const noPointsBody = await json(noPoints);
record(
  "Poin kurang",
  noPoints.status === 402 && noPointsBody.error?.code === "INSUFFICIENT_POINTS",
  `${noPoints.status} ${JSON.stringify(noPointsBody.error)}`,
);

await topup(sidA, sidAdmin);
await topup(sidB, sidAdmin);

const walletA0 = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));
record("Saldo setelah topup", walletA0.available >= 200, `available=${walletA0.available}`);

const failRes = await postJob(
  sidA,
  { mode: "t2i", prompt: "gagal dummy", params: { fail: true } },
  `k-fail-${stamp}`,
);
const failAccepted = await json(failRes);
record("POST gagal → 202", failRes.status === 202 && Boolean(failAccepted.job_id), `${failRes.status} ${failAccepted.status}`);
const failed = await waitJob(sidA, failAccepted.job_id);
const walletAfterFail = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));
record(
  "Gagal: release tanpa cooldown",
  failed.status === "failed" && walletAfterFail.available === walletA0.available && !failed.nextGenerateAt,
  `status=${failed.status} available=${walletAfterFail.available} next=${failed.nextGenerateAt}`,
);

const okRes = await postJob(sidA, { mode: "t2i", prompt: "sukses dummy" }, `k-ok-${stamp}`);
const okAccepted = await json(okRes);
record("POST sukses → 202 + hold", okRes.status === 202 && okAccepted.cost_held === 10, JSON.stringify(okAccepted));
const succeeded = await waitJob(sidA, okAccepted.job_id);
const walletAfterOk = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));
record(
  "Sukses: capture + cooldown",
  succeeded.status === "succeeded" &&
    walletAfterOk.available === walletA0.available - 10 &&
    Boolean(succeeded.nextGenerateAt) &&
    Boolean(succeeded.output?.url) &&
    String(succeeded.output.url).includes("localhost:9000"),
  `status=${succeeded.status} available=${walletAfterOk.available} url=${String(succeeded.output?.url).slice(0, 80)}`,
);

const replay = await postJob(sidA, { mode: "t2i", prompt: "sukses dummy" }, `k-ok-${stamp}`);
const replayBody = await json(replay);
record(
  "Idempotency-Key replay",
  replay.status === 202 && replayBody.job_id === okAccepted.job_id,
  `${replay.status} ${replayBody.job_id}`,
);

const cool = await postJob(sidA, { mode: "t2i", prompt: "masih cooldown" }, `k-cool-${stamp}`);
const coolBody = await json(cool);
record(
  "Cooldown 429",
  cool.status === 429 && coolBody.error?.code === "COOLDOWN" && typeof coolBody.retry_after_seconds === "number",
  `${cool.status} ${JSON.stringify(coolBody)}`,
);

const bSeesA = await fetch(`${API}/api/jobs/${okAccepted.job_id}`, { headers: userHeaders(sidB) });
record("User B GET job A = 404", bSeesA.status === 404, `status=${bSeesA.status}`);

const key1 = `k-race1-${stamp}`;
const key2 = `k-race2-${stamp}`;
const [r1, r2] = await Promise.all([
  postJob(sidB, { mode: "t2i", prompt: "tab 1" }, key1),
  postJob(sidB, { mode: "t2i", prompt: "tab 2" }, key2),
]);
const b1 = await json(r1);
const b2 = await json(r2);
const codes = [r1.status, r2.status].sort();
record(
  "Dua tab: satu 202 satu 409",
  codes[0] === 202 && codes[1] === 409,
  `status=${r1.status}/${r2.status} codes=${b1.error?.code ?? b1.status}/${b2.error?.code ?? b2.status}`,
);

const winner = r1.status === 202 ? b1 : b2;
if (winner.job_id) {
  const done = await waitJob(sidB, winner.job_id);
  record("Job pemenang selesai", done.status === "succeeded" || done.status === "failed", done.status);
}

const webGen = await fetch(`${WEB}/generate`, { redirect: "manual" });
record(
  "/generate tanpa login",
  webGen.status === 307 && webGen.headers.get("location")?.includes("/login"),
  `${webGen.status} ${webGen.headers.get("location")}`,
);

const failed2 = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed2.length}/${results.length} pass`);
if (failed2.length) process.exit(1);
