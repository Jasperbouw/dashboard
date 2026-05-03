import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bouw Check — Command Center",
  description: "Business dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
