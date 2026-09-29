import "@mantine/core/styles.css";
import "./globals.css";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/app-providers";

const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

export const metadata: Metadata = {
  title: {
    template: "%s | satulabs.id",
    default: "satulabs.id — Platform Studio AI Video & Photo",
  },
  description:
    "Platform studio AI video dan photo untuk kamu yang ingin kebebasan kreasi sesungguhnya. Tanpa langganan bulanan mengikat, hasil sekelas studio profesional.",
  keywords: [
    "AI Studio",
    "AI Video Generator",
    "AI Image Generator",
    "satulabs",
    "satulabs.id",
    "Kreator Konten",
  ],
  authors: [{ name: "satulabs.id" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://satulabs.id"),
  openGraph: {
    title: "satulabs.id — Platform Studio AI Video & Photo",
    description:
      "Platform studio AI video dan photo untuk kamu yang ingin kebebasan kreasi sesungguhnya. Cukup beli sparks saat kamu butuh.",
    url: "https://satulabs.id",
    siteName: "satulabs.id",
    locale: "id_ID",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" {...mantineHtmlProps} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
        {gtmId ? (
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        ) : null}
      </head>
      <body suppressHydrationWarning>
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
