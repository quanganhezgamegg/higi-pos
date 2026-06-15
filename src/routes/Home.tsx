import { Link } from "react-router-dom"
import { BarChart3, Coffee, LayoutGrid, Settings, Table2, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Home() {
  const items = [
    { to: "/sales", label: "Bán hàng", icon: Coffee, primary: true },
    { to: "/shift", label: "Ca làm việc", icon: Timer },
    { to: "/tables", label: "Sơ đồ bàn", icon: Table2 },
    { to: "/menu", label: "Menu", icon: LayoutGrid },
    { to: "/reports", label: "Báo cáo", icon: BarChart3 },
    { to: "/settings", label: "Cài đặt", icon: Settings },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-muted/20 p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">HiGi POS</h1>
        <p className="text-sm text-muted-foreground">
          Bán hàng tại quầy, offline, dữ liệu local SQLite.
        </p>
      </header>
      <div className="grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.to}
              asChild
              variant={item.primary ? "default" : "outline"}
              className="h-28 flex-col gap-2 text-base"
            >
              <Link to={item.to}>
                <Icon className="size-7" />
                {item.label}
              </Link>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
