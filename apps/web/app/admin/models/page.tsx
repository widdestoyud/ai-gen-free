import { AdminModelsView, type AdminModelItem, type DefaultGenerationModelsConfig } from "@/views/admin/models";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

const FALLBACK_CONFIG: DefaultGenerationModelsConfig = {
  normalT2iModelId: "openai/gpt-image-2-t2i",
  normalI2iModelId: "openai/gpt-image-2-edit",
  spicyT2iModelId: "bytedance/seedream-5.0-pro-t2i-spicy",
  spicyI2iModelId: "alibaba/qwen-image-3-edit-spicy",
  normalVideoModelId: "bytedance/seedance-2.5-i2v",
  spicyVideoModelId: "bytedance/seedance-2.0-i2v-spicy",
};

async function loadData() {
  const res = await fetchAdminApi("/api/admin/models/settings");
  if (!res || !res.ok) {
    return { config: FALLBACK_CONFIG, models: [] as AdminModelItem[] };
  }
  const body = (await res.json()) as { config?: DefaultGenerationModelsConfig; models?: AdminModelItem[] };
  return {
    config: body.config ?? FALLBACK_CONFIG,
    models: body.models ?? [],
  };
}

export default async function AdminModelsPage() {
  const me = await loadAdminMe();
  const data = me ? await loadData() : { config: FALLBACK_CONFIG, models: [] };
  return <AdminModelsView config={data.config} models={data.models} />;
}
