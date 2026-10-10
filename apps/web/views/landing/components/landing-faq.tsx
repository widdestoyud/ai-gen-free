"use client";

import { Container, Accordion, Title, Text } from "@mantine/core";
import classes from "./landing.module.css";
import { useI18n } from "@/lib/i18n";

export function LandingFaq() {
  const t = useI18n("landing");

  const faqs = [
    {
      q: t("faq.q1"),
      a: t("faq.a1"),
    },
    {
      q: t("faq.q2"),
      a: t("faq.a2"),
    },
    {
      q: t("faq.q3"),
      a: t("faq.a3"),
    },
    {
      q: t("faq.q4"),
      a: t("faq.a4"),
    },
    {
      q: t("faq.q5"),
      a: t("faq.a5"),
    },
    {
      q: t("faq.q6"),
      a: t("faq.a6"),
    },
    {
      q: t("faq.q7"),
      a: t("faq.a7"),
    },
  ];

  return (
    <section className={classes.faqSection} id="faq">
      <Container size="md">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>{t("faq.tag")}</span>
          <Title className={classes.sectionTitle} order={2}>
            {t("faq.title")}
          </Title>
          <Text className={classes.sectionSubtitle}>
            {t("faq.subtitle")}
          </Text>
        </div>

        <Accordion
          variant="separated"
          radius="md"
          styles={{
            item: {
              backgroundColor: "rgba(17, 19, 28, 0.65)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              transition: "border-color 0.2s ease",
              "&[data-active]": {
                borderColor: "rgba(139, 92, 246, 0.4)",
                backgroundColor: "rgba(22, 25, 38, 0.8)",
              },
            },
            control: {
              color: "#ffffff",
              "&:hover": {
                backgroundColor: "transparent",
              },
            },
            panel: {
              color: "#94a3b8",
            },
          }}
        >
          {faqs.map((faq) => (
            <Accordion.Item key={faq.q} value={faq.q} mb="xs">
              <Accordion.Control>
                <Text fw={600} size="sm">
                  {faq.q}
                </Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Text size="sm" c="#94a3b8" lh={1.6}>
                  {faq.a}
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
