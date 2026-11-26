import type { Metadata } from "next";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";
import {
  AdminTemplatesView,
  type AdminTemplatesListResponse,
  type AdminTemplatesSearchParams,
} from "@/views/admin/templates";

export const metadata: Metadata = {
  title: "Template Studio",
  description: "Manajemen template galeri studio AI, cover, dan gambar referensi.",
  robots: { index: false, follow: false },
};

function buildTemplatesQuery(params?: AdminTemplatesSearchParams): string {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", params.page);
  if (params?.limit) query.set("limit", params.limit);
  if (params?.q) query.set("q", params.q);
  if (params?.category && params.category !== "all") query.set("category", params.category);
  if (params?.isSpicy && params.isSpicy !== "all") query.set("isSpicy", params.isSpicy);
  if (params?.isActive && params.isActive !== "all") query.set("isActive", params.isActive);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);
  return query.toString();
}

function collectCategories(
  lists: Array<AdminTemplatesListResponse | null>,
  activeCategory?: string,
): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const item of list.items) {
      const clean = item.category?.trim();
      if (clean) set.add(clean);
    }
  }
  const activeClean = activeCategory?.trim();
  if (activeClean && activeClean !== "all") {
    set.add(activeClean);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

async function fetchTemplatesData(params?: AdminTemplatesSearchParams): Promise<{
  list: AdminTemplatesListResponse;
  categories: string[];
}> {
  const fallbackPage = Math.max(1, Number(params?.page ?? 1) || 1);
  const fallbackLimit = Math.min(100, Math.max(1, Number(params?.limit ?? 20) || 20));
  const fallbackList: AdminTemplatesListResponse = {
    items: [],
    total: 0,
    page: fallbackPage,
    limit: fallbackLimit,
  };

  const qs = buildTemplatesQuery(params);
  const mainUrl = `/api/admin/templates${qs ? `?${qs}` : ""}`;
  const shouldFetchAllInParallel = Boolean(qs);

  const [mainRes, parallelCatRes] = await Promise.all([
    fetchAdminApi(mainUrl),
    shouldFetchAllInParallel
      ? fetchAdminApi("/api/admin/templates?limit=100&sortBy=createdAt&sortOrder=desc")
      : Promise.resolve(null),
  ]);

  let mainList = fallbackList;
  if (mainRes && mainRes.ok) {
    const parsed = (await mainRes.json()) as Partial<AdminTemplatesListResponse>;
    mainList = {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      total: typeof parsed.total === "number" ? parsed.total : 0,
      page: typeof parsed.page === "number" ? parsed.page : fallbackPage,
      limit: typeof parsed.limit === "number" ? parsed.limit : fallbackLimit,
    };
  }

  let catRes = parallelCatRes;
  if (!shouldFetchAllInParallel && mainList.total > mainList.items.length) {
    catRes = await fetchAdminApi("/api/admin/templates?limit=100&sortBy=createdAt&sortOrder=desc");
  }

  let catList: AdminTemplatesListResponse | null = null;
  if (catRes && catRes.ok) {
    const parsed = (await catRes.json()) as Partial<AdminTemplatesListResponse>;
    catList = {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      total: typeof parsed.total === "number" ? parsed.total : 0,
      page: 1,
      limit: 100,
    };
  }

  return {
    list: mainList,
    categories: collectCategories([mainList, catList], params?.category),
  };
}

export default async function AdminTemplatesPage(props: {
  searchParams: Promise<AdminTemplatesSearchParams>;
}) {
  const me = await loadAdminMe();
  const searchParams = await props.searchParams;
  const result = me
    ? await fetchTemplatesData(searchParams)
    : {
        list: { items: [], total: 0, page: 1, limit: 20 },
        categories: [],
      };

  return (
    <AdminTemplatesView
      me={me}
      data={result.list}
      categories={result.categories}
      currentParams={searchParams}
    />
  );
}
