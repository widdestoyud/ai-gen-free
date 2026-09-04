import type { ReactNode } from "react";

export const metadata = {
  title: "ai-gen-free",
  description: "Platform generator",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#0f1115",
          color: "#e8eaed",
        }}
      >
        {children}
      </body>
    </html>
  );
}
