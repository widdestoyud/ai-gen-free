"use client";

import { Container, Grid, Title, Text, Stack } from "@mantine/core";
import classes from "./landing.module.css";
import type { PublicPackage } from "@/lib/server-api";
import { PackageCard } from "@/components/package-card";
import { buildPlanFromPackage, DEFAULT_PRICING_PLANS } from "@/lib/pricing-packages";

interface LandingPricingProps {
  onSelectPlan: (planId?: string) => void;
  packages?: PublicPackage[];
}

export function LandingPricing({ onSelectPlan, packages }: LandingPricingProps) {
  const plans =
    packages && packages.length > 0
      ? packages.map((pkg, idx) => buildPlanFromPackage(pkg, idx, packages.length))
      : DEFAULT_PRICING_PLANS;

  return (
    <section className={classes.pricingSection} id="pricing">
      <div id="harga" style={{ position: "relative", top: -80 }} aria-hidden="true" />
      <Container size="xl">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>
            INVESTASI HEMAT · TANPA AUTO-DEBET KARTU KREDIT
          </span>
          <Title className={classes.sectionTitle} order={2}>
            Pilihan Paket Transparan.
            <br />
            <span className={classes.heroTitleHighlight}>
              Hasil Sekelas Studio Profesional.
            </span>
          </Title>
          <Text className={classes.sectionSubtitle}>
            Tanpa ikatan langganan bulanan yang membengkak. Cukup isi saldo sparks saat kamu butuh mulai dari Rp 49.000.
            Sparks-mu aman selamanya dan tidak pernah kedaluwarsa.
          </Text>
        </div>

        <Grid gutter="xl" align="stretch">
          {plans.map((plan) => (
            <Grid.Col
              span={{ base: 12, md: Math.max(4, Math.floor(12 / Math.min(plans.length, 3))) }}
              key={plan.id}
            >
              <PackageCard
                id={plan.id}
                name={plan.name}
                label={plan.label}
                badgeText={plan.badgeText}
                description={plan.description}
                price={plan.price}
                originalPrice={plan.originalPrice}
                points={plan.points}
                popular={plan.popular}
                perks={plan.perks}
                buttonLabel={`Pilih ${plan.name}`}
                onSelect={(id) => onSelectPlan(id)}
              />
            </Grid.Col>
          ))}
        </Grid>

        <Stack align="center" ta="center" mt={48} gap="xs">
          <Text size="xs" c="dimmed">
            Sparks otomatis bertambah setelah pembayaran terverifikasi. Saldo sparks berlaku selamanya tanpa batas kedaluwarsa.
          </Text>
        </Stack>
      </Container>
    </section>
  );
}
