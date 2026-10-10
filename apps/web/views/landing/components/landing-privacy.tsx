"use client";

import { Container, Grid, Stack, Title, Text, Button, Anchor } from "@mantine/core";
import Link from "next/link";
import classes from "./landing.module.css";
import { useI18n } from "@/lib/i18n";

export function LandingPrivacy() {
  const t = useI18n("landing");

  const privacyPoints = [
    {
      title: t("privacy.point_1_title"),
      description: t("privacy.point_1_desc"),
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      title: t("privacy.point_2_title"),
      description: t("privacy.point_2_desc"),
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      title: t("privacy.point_3_title"),
      description: t("privacy.point_3_desc"),
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
  ];

  return (
    <section className={classes.privacySection} id="privasi">
      <Container size="xl">
        <Grid gutter={48} align="center">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="lg">
              <div>
                <span className={classes.sectionTag}>
                  {t("privacy.tag")}
                </span>
              </div>

              <Title className={classes.sectionTitle} order={2}>
                {t("privacy.title_line1")}
                <br />
                <span className={classes.heroTitleHighlight}>{t("privacy.title_line2")}</span>
              </Title>

              <Text size="md" c="#94a3b8" lh={1.6}>
                {t("privacy.subtitle")}
              </Text>

              <div>
                <Button
                  component={Link}
                  href="/privacy"
                  variant="light"
                  color="violet"
                  size="md"
                  radius="md"
                  rightSection={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                  }
                >
                  {t("privacy.btn_detail")}
                </Button>
              </div>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="md">
              {privacyPoints.map((item) => (
                <div key={item.title} className={classes.privacyItem}>
                  <div className={classes.privacyItemIcon}>{item.icon}</div>
                  <Stack gap={4}>
                    <Title order={4} size="h5" c="white">
                      {item.title}
                    </Title>
                    <Text size="sm" c="#94a3b8" lh={1.6}>
                      {item.description}
                    </Text>
                  </Stack>
                </div>
              ))}

              <Text size="xs" c="dimmed" mt="xs" lh={1.5}>
                <strong>{t("privacy.notice_prefix")}</strong> {t("privacy.notice_text")}{" "}
                <Anchor component={Link} href="/privacy" c="violet.4" size="xs">
                  {t("privacy.notice_link")}
                </Anchor>
                .
              </Text>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </section>
  );
}
