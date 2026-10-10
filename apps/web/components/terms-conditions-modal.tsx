"use client";

import { Button, Group, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { useI18n } from "@/lib/i18n";

export interface TermsConditionsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function TermsConditionsModal({ opened, onClose }: TermsConditionsModalProps) {
  const t = useI18n("modals");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("terms.title")}
      centered
      size="lg"
    >
      <Stack gap="md">
        <Paper p="md" withBorder radius="sm" bg="var(--mantine-color-dark-8, #1a1b1e)">
          <ScrollArea.Autosize mah={360} type="scroll">
            <Stack gap="sm">
              <Text size="sm" fw={600}>
                {t("terms.heading")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("terms.intro")}
              </Text>
              
              <Text size="xs" fw={600} mt="xs">
                {t("terms.sec_1_title")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("terms.sec_1_desc")}
              </Text>

              <Text size="xs" fw={600} mt="xs">
                {t("terms.sec_2_title")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("terms.sec_2_desc")}
              </Text>

              <Text size="xs" fw={600} mt="xs">
                {t("terms.sec_3_title")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("terms.sec_3_desc")}
              </Text>

              <Text size="xs" fw={600} mt="xs">
                {t("terms.sec_4_title")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("terms.sec_4_desc")}
              </Text>

              <Text size="xs" fw={600} mt="xs">
                {t("terms.sec_5_title")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("terms.sec_5_desc")}
              </Text>
            </Stack>
          </ScrollArea.Autosize>
        </Paper>

        <Group justify="flex-end">
          <Button
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            onClick={onClose}
            size="sm"
          >
            {t("terms.btn_agree")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
