import {
  Boxes,
  ChefHat,
  Home,
  ReceiptText,
  Settings,
  ShoppingCart,
  Table2,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  icon: LucideIcon
  to?: string
  disabled?: boolean
}

const items: NavItem[] = [
  { label: "Trang chủ", icon: Home, to: "/" },
  { label: "Bán hàng", icon: ShoppingCart, to: "/sales" },
  { label: "Bàn", icon: Table2, to: "/tables" },
  { label: "Thực đơn", icon: ChefHat, to: "/menu" },
  { label: "Kho", icon: Boxes, disabled: true },
  { label: "Khách hàng", icon: Users, disabled: true },
  { label: "Báo cáo", icon: ReceiptText, to: "/reports" },
  { label: "Ca", icon: Timer, to: "/shift" },
  { label: "Cài đặt", icon: Settings, to: "/settings" },
]

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/"
  if (to === "/sales") return pathname === "/sales" || pathname.startsWith("/payment/")
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function NavRail() {
  const location = useLocation()

  return (
    <nav className="flex h-full w-24 shrink-0 flex-col gap-2 overflow-y-auto border-r bg-card p-2 py-5">
      {items.map((item) => {
        const Icon = item.icon
        const baseClass =
          "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-3 text-center text-[11px] font-bold transition"

        if (item.disabled || !item.to) {
          return (
            <button
              key={item.label}
              aria-label={item.label}
              className={cn(baseClass, "cursor-not-allowed text-muted-foreground opacity-40")}
              disabled
              title="Sắp có"
              type="button"
            >
              <Icon className="size-6" />
              <span className="leading-tight">{item.label}</span>
            </button>
          )
        }

        return (
          <NavLink
            key={item.label}
            aria-current={isActive(location.pathname, item.to) ? "page" : undefined}
            className={cn(
              baseClass,
              isActive(location.pathname, item.to)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
            )}
            to={item.to}
          >
            <Icon className="size-6" />
            <span className="leading-tight">{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
