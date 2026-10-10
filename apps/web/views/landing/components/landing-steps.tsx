"use client";

import { Container, Title, Text } from "@mantine/core";
import classes from "./landing.module.css";
import { useI18n } from "@/lib/i18n";

export function LandingSteps() {
  const t = useI18n("landing");

  const steps = [
    {
      step: "01",
      title: t("steps.step_1_title"),
      description: t("steps.step_1_desc"),
    },
    {
      step: "02",
      title: t("steps.step_2_title"),
      description: t("steps.step_2_desc"),
    },
    {
      step: "03",
      title: t("steps.step_3_title"),
      description: t("steps.step_3_desc"),
    },
  ];

  return (
    <section className={classes.stepsSection} id="langkah">
      <Container size="xl">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>{t("steps.tag")}</span>
          <Title className={classes.sectionTitle} order={2}>
            {t("steps.title_line1")}
            <br />
            <span className={classes.heroTitleHighlight}>
              {t("steps.title_line2")}
            </span>
          </Title>
          <Text className={classes.sectionSubtitle}>
            {t("steps.subtitle")}
          </Text>
        </div>

        <div className={classes.stepsGrid}>
          {steps.map((item) => (
            <div className={classes.stepCard} key={item.step}>
              <div className={classes.stepNumber}>{item.step}</div>
              <h3 className={classes.stepTitle}>{item.title}</h3>
              <p className={classes.stepDesc}>{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
