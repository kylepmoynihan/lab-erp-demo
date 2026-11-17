"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLab } from "@/lib/store";

const LINKS = [
  ["/erp/", "ERP map"],
  ["/", "Overview"],
  ["/admin/stats/", "Stats"],
  ["/admin/alerts/", "Alerts"],
  ["/admin/digest/", "Digest"],
  ["/admin/log/", "Clocking log"],
  ["/admin/stations/", "Stations & QR"],
] as const;

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const { data, reset } = useLab();
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  return (
    <div className="shell">
      <header className="topbar noprint">
        <Link href="/" className="brand">
          Lab ERP<small>demo · sample data</small>
        </Link>
        <nav className="nav">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={norm(path) === href ? "on" : ""}>
              {label}
            </Link>
          ))}
        </nav>
        <span className="spacer" />
        <button onClick={reset} title="Clear your demo scans and start over">Reset demo</button>
      </header>
      {data ? children : <p className="muted">Loading sample data…</p>}
    </div>
  );
}
