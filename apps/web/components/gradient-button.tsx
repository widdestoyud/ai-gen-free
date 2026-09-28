"use client";

import { Button, type ButtonProps, type ElementProps } from "@mantine/core";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export interface GradientButtonProps
  extends ButtonProps,
    ElementProps<"button", keyof ButtonProps> {}

export const GradientButton = forwardRef<HTMLButtonElement, any>(
  ({ children, variant = "gradient", gradient = { from: "#3b82f6", to: "#8b5cf6", deg: 135 }, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        gradient={gradient}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

GradientButton.displayName = "GradientButton";
