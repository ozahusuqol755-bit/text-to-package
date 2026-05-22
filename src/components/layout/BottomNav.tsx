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
  { to: "/sources", label: "Источ.", Icon: Inbox },
  { to: "/analysis", label: "Анализ", Icon: Brain },
  { to: "/ideas", label: "Идеи", Icon: Lightbulb },
  { to: "/packs", label: "Пакеты", Icon: Package },
  { to: "/review", label: "Проверка", Icon: ShieldCheck },
  { to: "/publish", label: "Выход", Icon: Rocket },
  { to: "/metrics", label: "Метрики", Icon: BarChart3 },
  { to: "/tools", label: "Тулзы", Icon: Wrench },
  { to: "/logs", label: "Логи", Icon: ScrollText },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 inset-x-0 border-t border-border bg-[oklch(0.18_0.03_260/0.95)] backdrop-blur z-20">
      <div className="grid grid-cols-5 gap-0.5 px-1 py-1 overflow-x-auto">
        {nav.map(({ to, label, Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] transition ${
                active
                  ? "bg-primary/20 text-primary-foreground/95"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`size-4 ${active ? "text-primary" : ""}`} />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
