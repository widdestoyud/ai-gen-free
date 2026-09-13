import { redirect } from "next/navigation";
import { loadLibrary } from "@/lib/server-api";
import { LibraryPageView } from "@/views/app/library";

export const dynamic = "force-dynamic";

export default async function AppLibraryPage() {
  const data = await loadLibrary();
  if (!data) {
    redirect("/");
  }

  return (
    <LibraryPageView
      initialJobs={data.jobs}
      nextGenerateAt={data.nextGenerateAt}
    />
  );
}
