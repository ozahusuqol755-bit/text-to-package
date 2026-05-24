import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Inbox,
  Brain,
  Lightbulb,
  Package,
  ShieldCheck,
  Rocket,
  BarChart3,
  Wrench,
  ScrollText,
} from "lucide-react";

const nav = [
  { to: "/", label: "Главная", Icon: Home },
  { to: "/sources", label: "Источники", Icon: Inbox },
  { to: "/analysis", label: "Анализ", Icon: Brain },
  { to: "/ideas", label: "Идеи", Icon: Lightbulb },
  { to: "/packs", label: "Пакеты", Icon: Package },
  { to: "/review", label: "Проверка", Icon: ShieldCheck },
  { to: "/publish", label: "Публикация", Icon: Rocket },
  { to: "/metrics", label: "Метрики", Icon: BarChart3 },
  { to: "/tools", label: "Инструменты", Icon: Wrench },
  { to: "/logs", label: "Логи", Icon: ScrollText },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 inset-x-0 border-t border-border bg-[oklch(0.18_0.03_260/0.95)] backdrop-blur z-20 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 gap-1 px-1.5 py-1.5">
        {nav.map(({ to, label, Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 min-h-[52px] text-[10px] leading-none transition ${
                active
                  ? "bg-primary/25 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <Icon className={`size-[18px] ${active ? "text-primary" : ""}`} />
              <span className="truncate w-full text-center px-0.5">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
