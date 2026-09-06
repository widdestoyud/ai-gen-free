import "@mantine/core/styles.css";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/app-providers";

export const metadata = {
  title: "ai-gen-free",
  description: "Platform generator",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
