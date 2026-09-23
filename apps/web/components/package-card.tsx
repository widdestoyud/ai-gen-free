"use client";

import { Title, Text, Badge, Group, Stack, Button } from "@mantine/core";
import classes from "./package-card.module.css";

export interface PackageCardProps {
  id: string;
  name: string;
  label?: string | null;
  badgeText?: string | null;
  description?: string | null;
  price: string;
  originalPrice?: string | null;
  points: number | string;
  popular?: boolean;
  perks?: string[];
  estimationText?: string;
  buttonLabel?: string;
  buttonVariant?: "filled" | "light";
  loading?: boolean;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

export function PackageCard({
  id,
  name,
  label,
  badgeText,
  description,
  price,
  originalPrice,
  points,
  popular = false,
  perks = [],
  estimationText,
  buttonLabel,
  buttonVariant,
  loading = false,
  disabled = false,
  onSelect,
}: PackageCardProps) {
  const displayLabel = badgeText || label || (popular ? "Paling Populer" : "Starter");
  const defaultButtonLabel = buttonLabel || `Pilih ${name}`;
  const defaultButtonVariant = buttonVariant || (popular ? "filled" : "light");

  return (
    <div className={`${classes.card} ${popular ? classes.cardPopular : ""}`}>
      {popular && <div className={classes.ribbonBadge}>BEST VALUE</div>}

      <div>
        <Group justify="space-between" mb="xs">
          <Title order={3} c="white" fz="lg" fw={700}>
            {name}
          </Title>
          <Badge variant="dot" color={popular ? "blue" : "gray"}>
            {displayLabel}
          </Badge>
        </Group>

        {description ? (
          <Text className={classes.description} mb="md">
            {description}
          </Text>
        ) : (
          <div className={classes.description} />
        )}

        <div className={classes.priceAmount}>
          {price}
          {originalPrice && (
            <span className={classes.originalPrice}>{originalPrice}</span>
          )}
        </div>

        <Badge color="blue" variant="light" size="lg" mt="xs" mb="lg">
          <strong>+{typeof points === "number" ? points.toLocaleString("id-ID") : points}</strong>&nbsp;poin
        </Badge>

        {estimationText ? (
          <Text size="xs" c="blue.4" fw={600} mb="lg">
            {estimationText}
          </Text>
        ) : null}

        {perks.length > 0 && (
          <Stack gap="xs" mb="xl">
            {perks.map((perk) => (
              <Group gap="xs" key={perk} align="flex-start">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <Text size="xs" c="gray.3">
                  {perk}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </div>

      <Button
        fullWidth
        size="md"
        variant={defaultButtonVariant}
        color="blue"
        loading={loading}
        disabled={disabled}
        onClick={() => onSelect(id)}
      >
        {defaultButtonLabel}
      </Button>
    </div>
  );
}
