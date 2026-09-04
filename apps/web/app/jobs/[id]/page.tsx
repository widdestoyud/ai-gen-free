import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JobClient } from "./job-client";

const apiBase = () => process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export type JobView = {
  id: string;
  status: string;
  progressPct: number;
  prompt: string;
  cost: number;
  errorCode: string | null;
  nextGenerateAt: string | null;
  output: { url: string; contentType: string; availableUntil: string } | null;
};

async function load(id: string): Promise<JobView | null | "unauth"> {
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) return "unauth";
  const res = await fetch(`${apiBase()}/api/jobs/${id}`, {
    headers: { cookie: `sid=${sid}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) return "unauth";
  return (await res.json()) as JobView;
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await load(id);
  if (job === "unauth") redirect("/login");
  if (!job) {
    return (
      <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1.5rem" }}>
        <p>Job tidak ditemukan.</p>
        <Link href="/generate" style={{ color: "#8ab4ff" }}>
          Kembali
        </Link>
      </main>
    );
  }
  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1.5rem" }}>
      <p>
        <Link href="/generate" style={{ color: "#8ab4ff" }}>
          ← Generate
        </Link>
      </p>
      <h1>Job</h1>
      <JobClient initial={job} />
    </main>
  );
}
