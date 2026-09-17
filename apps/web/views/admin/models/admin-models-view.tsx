import { Stack, Text } from "@mantine/core";
import { AdminPageShell } from "../components/admin-page-shell";
import { ModelDefaultsForm } from "./components/model-defaults-form";
import { ModelCatalogTable } from "./components/model-catalog-table";
import type { AdminModelItem, DefaultGenerationModelsConfig } from "./types";

export function AdminModelsView({
  config,
  models,
}: {
  config: DefaultGenerationModelsConfig;
  models: AdminModelItem[];
}) {
  return (
    <AdminPageShell title="Pengaturan Model AI (Video & Gambar)">
      <Stack gap="xl">
        <div>
          <Text size="sm" c="dimmed">
            Pusat konfigurasi model AI generator. Anda dapat menentukan model default untuk mode Video dan Gambar (baik mode standar maupun mode Spicy), serta mengelola daftar katalog model provider.
          </Text>
        </div>

        <ModelDefaultsForm initialConfig={config} models={models} />

        <ModelCatalogTable models={models} />
      </Stack>
    </AdminPageShell>
  );
}
