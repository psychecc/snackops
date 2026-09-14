import Link from "next/link";
import { Activity, Bot, Boxes, ClipboardCheck, FlaskConical, MessageCircle, Settings, TrendingUp, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { label: "Demo", href: "/demo", icon: MessageCircle, status: "可用" },
  { label: "Agent", href: "/", icon: Bot, status: "可用" },
  { label: "Ops", href: "/ops", icon: TrendingUp, status: "可用" },
  { label: "Eval", href: "/eval", icon: FlaskConical, status: "可用" },
  { label: "Planner", href: "/planner", icon: Activity, status: "可用" },
  { label: "Skill", href: "/skills", icon: ClipboardCheck, status: "可用" },
  { label: "Tool", href: "/tools", icon: Wrench, status: "可用" },
  { label: "Catalog", href: "/catalog", icon: Boxes, status: "可用" },
  { label: "Models", href: "/models", icon: Settings, status: "可用" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-black text-primary-foreground">
              SO
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-black">SnackOps</span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                零食电商客服 Agent 运营平台
              </span>
            </span>
          </Link>

          <nav className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                  <Badge tone={item.status === "可用" ? "success" : "neutral"}>{item.status}</Badge>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
