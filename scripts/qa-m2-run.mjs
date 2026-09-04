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
    const id = msg?.ID ?? msg?.ID;
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
  const reqRes = await fetch(`${API}/api/admin/auth/otp/request`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: BASIC },
    body: JSON.stringify({ email }),
  });
  if (!reqRes.ok) throw new Error("admin otp request " + reqRes.status);
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

function userHeaders(sid) {
  return { cookie: `sid=${sid}`, "content-type": "application/json" };
}
function adminHeaders(sid) {
  return {
    cookie: `sid_admin=${sid}`,
    authorization: BASIC,
    "content-type": "application/json",
  };
}

const stamp = Date.now();
const emailA = `m2a${stamp}@example.com`;
const emailB = `m2b${stamp}@example.com`;

const sidA = await loginUser(emailA);
const sidB = await loginUser(emailB);
const sidAdmin = await loginAdmin();

const wallet0 = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));
record("Saldo awal", wallet0.available === 0 && wallet0.held === 0, JSON.stringify(wallet0));

const inv = await json(
  await fetch(`${API}/api/invoices`, {
    method: "POST",
    headers: userHeaders(sidA),
    body: JSON.stringify({ packageId: "p50" }),
  }),
);
record(
  "Buat invoice p50",
  inv.status === "unpaid" && Boolean(inv.uniqueCode) && typeof inv.instructions === "string",
  `${inv.status} ${inv.uniqueCode}`,
);

const approveBare = await fetch(`${API}/api/admin/invoices/${inv.id}/approve`, {
  method: "POST",
  headers: adminHeaders(sidAdmin),
  body: "{}",
});
const approveBareBody = await json(approveBare);
record(
  "Approve tanpa bukti",
  approveBare.status === 400 && approveBareBody.error?.code === "PROOF_REQUIRED",
  `${approveBare.status} ${JSON.stringify(approveBareBody.error)}`,
);

const form = new FormData();
form.set("file", new Blob([PNG], { type: "image/png" }), "bukti.png");
const up = await fetch(`${API}/api/invoices/${inv.id}/proof`, {
  method: "POST",
  headers: { cookie: `sid=${sidA}` },
  body: form,
});
const upBody = await json(up);
record(
  "Unggah PNG",
  up.ok && upBody.status === "awaiting_review" && upBody.hasProof === true,
  `${up.status} ${upBody.status} hasProof=${upBody.hasProof}`,
);

const notes = await json(await fetch(`${API}/api/admin/notifications`, { headers: adminHeaders(sidAdmin) }));
record(
  "Notifikasi admin",
  notes.pendingCount >= 1 && notes.items.some((i) => i.invoiceId === inv.id),
  `pendingCount=${notes.pendingCount} codes=${(notes.items ?? []).map((i) => i.uniqueCode).join(",")}`,
);

const proofMeta = await json(
  await fetch(`${API}/api/admin/invoices/${inv.id}/proof`, { headers: adminHeaders(sidAdmin) }),
);
const publicHost = Boolean(proofMeta.url) && !String(proofMeta.url).includes("minio:");
record(
  "Signed URL publik",
  proofMeta.url?.startsWith("http://localhost:9000/") && publicHost,
  String(proofMeta.url ?? proofMeta.error).slice(0, 120),
);

const fileRes = await fetch(`${API}/api/admin/invoices/${inv.id}/file`, { headers: adminHeaders(sidAdmin) });
const fileBuf = Buffer.from(await fileRes.arrayBuffer());
record(
  "Stream bukti admin",
  fileRes.ok && fileRes.headers.get("content-type")?.includes("image/png") && fileBuf.length > 0,
  `${fileRes.status} ${fileRes.headers.get("content-type")} bytes=${fileBuf.length}`,
);

const signedGet = await fetch(proofMeta.url);
record(
  "MinIO privat signed GET",
  signedGet.ok && signedGet.status === 200,
  `status=${signedGet.status}`,
);

const anonObj = await fetch(`http://localhost:9000/generations/proofs/x/${inv.id}`);
record(
  "Bukti tidak public-read",
  anonObj.status === 403 || anonObj.status === 404,
  `status=${anonObj.status}`,
);

const bSeesA = await fetch(`${API}/api/invoices/${inv.id}`, { headers: userHeaders(sidB) });
const bUp = await fetch(`${API}/api/invoices/${inv.id}/proof`, {
  method: "POST",
  headers: { cookie: `sid=${sidB}` },
  body: form,
});
record(
  "User B tidak akses invoice A",
  bSeesA.status === 404 && (bUp.status === 404 || bUp.status === 400),
  `GET ${bSeesA.status} POST proof ${bUp.status}`,
);

const approve1 = await json(
  await fetch(`${API}/api/admin/invoices/${inv.id}/approve`, {
    method: "POST",
    headers: adminHeaders(sidAdmin),
    body: "{}",
  }),
);
const wallet1 = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));
record(
  "Admin terima",
  approve1.status === "paid" && wallet1.available === 500,
  `invoice=${approve1.status} available=${wallet1.available}`,
);

const approve2 = await json(
  await fetch(`${API}/api/admin/invoices/${inv.id}/approve`, {
    method: "POST",
    headers: adminHeaders(sidAdmin),
    body: "{}",
  }),
);
const wallet2 = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));
record(
  "Approve dua kali tidak double-topup",
  approve2.status === "paid" && wallet2.available === 500,
  `invoice=${approve2.status} available=${wallet2.available}`,
);

const inv2 = await json(
  await fetch(`${API}/api/invoices`, {
    method: "POST",
    headers: userHeaders(sidA),
    body: JSON.stringify({ packageId: "p20" }),
  }),
);
const form2 = new FormData();
form2.set("file", new Blob([PNG], { type: "image/png" }), "bukti2.png");
await fetch(`${API}/api/invoices/${inv2.id}/proof`, {
  method: "POST",
  headers: { cookie: `sid=${sidA}` },
  body: form2,
});
const rejected = await json(
  await fetch(`${API}/api/admin/invoices/${inv2.id}/reject`, {
    method: "POST",
    headers: adminHeaders(sidAdmin),
    body: JSON.stringify({ reason: "Nominal tidak sesuai struk" }),
  }),
);
const wallet3 = await json(await fetch(`${API}/api/wallet`, { headers: userHeaders(sidA) }));
const inv2got = await json(await fetch(`${API}/api/invoices/${inv2.id}`, { headers: userHeaders(sidA) }));
record(
  "Admin tolak",
  rejected.status === "rejected" &&
    wallet3.available === 500 &&
    inv2got.reviewNote?.includes("Nominal"),
  `status=${rejected.status} note=${inv2got.reviewNote} available=${wallet3.available}`,
);

const reup = await json(
  await fetch(`${API}/api/invoices/${inv2.id}/proof`, {
    method: "POST",
    headers: { cookie: `sid=${sidA}` },
    body: form2,
  }),
);
record("Unggah ulang setelah tolak", reup.status === "awaiting_review", String(reup.status));

const credit = await fetch(`${API}/api/wallet/credit`, {
  method: "POST",
  headers: userHeaders(sidA),
  body: JSON.stringify({ points: 9999 }),
});
record("POST /api/wallet/credit", credit.status === 404, `status=${credit.status}`);

const webWallet = await fetch(`${WEB}/wallet`, { redirect: "manual" });
record(
  "/wallet tanpa login",
  webWallet.status === 307 && webWallet.headers.get("location")?.includes("/login"),
  `${webWallet.status} ${webWallet.headers.get("location")}`,
);

const webHealth = await json(await fetch(`${WEB}/api/health`));
record("Web proxy /api/health", webHealth.ok === true, JSON.stringify(webHealth));

const webUpload = await fetch(`${WEB}/api/invoices/${inv2.id}`, {
  headers: { cookie: `sid=${sidA}` },
});
const webInv = await json(webUpload);
record(
  "Web proxy invoice milik sendiri",
  webUpload.ok && webInv.id === inv2.id,
  `${webUpload.status} ${webInv.status}`,
);

const paid = await fetch(`${API}/api/admin/invoices/${inv.id}/paid`, {
  method: "POST",
  headers: adminHeaders(sidAdmin),
  body: "{}",
});
record("Tidak ada POST /paid lama", paid.status === 404, `status=${paid.status}`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) process.exit(1);
