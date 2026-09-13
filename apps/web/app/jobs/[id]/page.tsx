import { redirect } from "next/navigation";
import type { JobView } from "@/lib/job-status";
import { fetchUserApi } from "@/lib/server-api";
import { JobPageView } from "@/views/jobs";

async function load(id: string): Promise<JobView | null | "unauth"> {
  const res = await fetchUserApi(`/api/jobs/${id}`);
  if (!res) return "unauth";
  if (res.status === 404) return null;
  if (!res.ok) return "unauth";
  return (await res.json()) as JobView;
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await load(id);
  if (job === "unauth") redirect("/");
  return <JobPageView job={job} />;
}
