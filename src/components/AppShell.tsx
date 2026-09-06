import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/monitoring", label: "Disaster monitoring" },
  { to: "/simulation", label: "Simulation" },
  { to: "/resources", label: "Resource management" },
  { to: "/allocations", label: "Allocation results" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className="inline-block h-5 w-5"
            style={{ background: "var(--primary)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
          />
          <span className="text-sm font-bold tracking-tight" style={{ color: "var(--brand)" }}>
            Relief Allocation Console
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="border border-transparent px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-ink"
              activeOptions={{ exact: n.to === "/" }}
              activeProps={{
                className:
                  "border border-line bg-accent px-2.5 py-1 text-[13px] font-semibold text-ink",
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--sev-low)" }} />
            Feeds live
            <span className="data">· updated 09:58 IST</span>
          </span>
          <span className="text-[13px]">
            Welcome back, A. Rane — Operator
          </span>
          <Link to="/login" className="border border-line px-2 py-1 text-[12px] hover:bg-accent">
            Sign out
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
