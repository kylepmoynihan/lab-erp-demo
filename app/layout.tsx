import type { Metadata } from "next";
import "./globals.css";
import { LabProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Lab Time Tracker",
  description: "QR time tracking, checkpoint compliance and missed-scan alerts for a small production lab. Demo on sample data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <LabProvider>{children}</LabProvider>
      </body>
    </html>
  );
}
