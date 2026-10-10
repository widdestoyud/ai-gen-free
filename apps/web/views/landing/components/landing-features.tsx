"use client";

import { Container, Title, Text } from "@mantine/core";
import classes from "./landing.module.css";
import { useI18n } from "@/lib/i18n";

export function LandingFeatures() {
  const t = useI18n("landing");

  const features = [
    {
      title: t("features.card_1_title"),
      category: t("features.card_1_tag"),
      description: t("features.card_1_desc"),
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
    },
    {
      title: t("features.card_2_title"),
      category: t("features.card_2_tag"),
      description: t("features.card_2_desc"),
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      ),
    },
    {
      title: t("features.card_3_title"),
      category: t("features.card_3_tag"),
      description: t("features.card_3_desc"),
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      title: t("features.card_4_title"),
      category: t("features.card_4_tag"),
      description: t("features.card_4_desc"),
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      title: t("features.card_5_title"),
      category: t("features.card_5_tag"),
      description: t("features.card_5_desc"),
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
    {
      title: t("features.card_6_title"),
      category: t("features.card_6_tag"),
      description: t("features.card_6_desc"),
      icon: (
        <svg
          width="24"
          height="24"
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
    <section className={classes.spotlightSectionDarker} id="fitur">
      <Container size="xl">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>{t("features.tag")}</span>
          <Title className={classes.sectionTitle} order={2}>
            {t("features.title_line1")}
            <br />
            <span className={classes.heroTitleHighlight}>
              {t("features.title_line2")}
            </span>
          </Title>
          <Text className={classes.sectionSubtitle}>
            {t("features.subtitle")}
          </Text>
        </div>

        <div className={classes.bentoGrid}>
          {features.map((feature) => (
            <div className={classes.bentoCard} key={feature.title}>
              <div className={classes.bentoIconWrapper}>{feature.icon}</div>
              <span className={classes.bentoTag}>{feature.category}</span>
              <h3 className={classes.bentoTitle}>{feature.title}</h3>
              <p className={classes.bentoDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
