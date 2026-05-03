"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, FolderKanban, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Bitácora", href: "/bitacora", icon: BookOpen },
  { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
  { label: "Traspaso", href: "/traspaso", icon: ArrowLeftRight, exact: true },
];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (item: (typeof navItems)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <nav
      aria-label="Navegación móvil"
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0a0f1e]/95 backdrop-blur-xl print:hidden safe-area-inset-bottom"
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-all duration-200",
                active ? "text-[#ffeb66]" : "text-white/40 hover:text-white/70"
              )}
            >
              <Icon className={cn("w-5 h-5 transition-transform duration-200", active ? "scale-110" : "")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
