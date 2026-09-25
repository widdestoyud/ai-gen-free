import "@mantine/core/styles.css";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/app-providers";

export const metadata = {
  title: "satulabs.id",
  description: "Platform AI Generator Kreatif - satulabs.id",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" {...mantineHtmlProps} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
