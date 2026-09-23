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
    <section className={classes.pricingSection} id="harga">
      <Container size="lg">
        <Stack align="center" ta="center" mb={56}>
          <Text size="xs" fw={800} c="blue.4" tt="uppercase" lts={1}>
            PILIHAN PAKET STARTER & PRO · TANPA LANGGANAN KARTU KREDIT
          </Text>
          <Title order={2} fz={{ base: "1.8rem", sm: "2.6rem" }} fw={900}>
            Investasi hemat,
            <br />
            hasil <span className={classes.heroTitleHighlight}>sekelas studio profesional.</span>
          </Title>
          <Text c="dimmed" maw={640} fz="md">
            Tanpa ikatan langganan bulanan yang mengikat. Cukup beli poin saat kamu butuh
            mulai dari Rp 49.000. Poinmu aman dan tidak pernah kedaluwarsa.
          </Text>
        </Stack>

        <Grid gutter="xl" align="stretch">
          {plans.map((plan) => (
            <Grid.Col span={{ base: 12, md: Math.max(4, Math.floor(12 / Math.min(plans.length, 3))) }} key={plan.id}>
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
            Poin otomatis bertambah setelah pembayaran diverifikasi. Saldo poin aman tanpa batas kedaluwarsa.
          </Text>
        </Stack>
      </Container>
    </section>
  );
}
