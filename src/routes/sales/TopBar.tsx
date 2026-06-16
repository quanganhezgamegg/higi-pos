import { Home, Search } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { OrderType } from "@/lib/api/orders"
import type { Shift } from "@/lib/api/shifts"
import type { TableStatus } from "@/lib/api/tables"

type TopBarProps = {
  orderType: OrderType
  tableId: number | null
  freeTables: TableStatus[]
  searchQuery: string
  shift: Shift
  onOrderTypeChange: (type: OrderType) => void
  onTableChange: (tableId: number | null) => void
  onSearchChange: (query: string) => void
}

export function TopBar({
  freeTables,
  orderType,
  searchQuery,
  shift,
  tableId,
  onOrderTypeChange,
  onSearchChange,
  onTableChange,
}: TopBarProps) {
  const selectedTable = freeTables.find((status) => status.table.id === tableId)

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-5">
      <div className="flex rounded-2xl border bg-background p-1">
        <button
          className={`h-10 rounded-xl px-4 text-sm font-bold transition-colors ${
            orderType === "TAKEAWAY"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-primary"
          }`}
          onClick={() => {
            onOrderTypeChange("TAKEAWAY")
            onTableChange(null)
          }}
        >
          Mang đi
        </button>
        <button
          className={`h-10 rounded-xl px-4 text-sm font-bold transition-colors ${
            orderType === "DINE_IN"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-primary"
          }`}
          onClick={() => onOrderTypeChange("DINE_IN")}
        >
          Tại bàn
        </button>
      </div>

      {orderType === "DINE_IN" && (
        <select
          aria-label="Chọn bàn"
          className="h-11 rounded-2xl border bg-background px-3 text-sm font-medium"
          value={tableId ?? ""}
          onChange={(event) => onTableChange(Number(event.target.value) || null)}
        >
          <option value="">Chọn bàn...</option>
          {freeTables.map((status) => (
            <option key={status.table.id} value={status.table.id}>
              {status.table.name}
            </option>
          ))}
        </select>
      )}

      {selectedTable && (
        <Badge variant="secondary" className="h-8 rounded-full px-3">
          {selectedTable.table.name}
        </Badge>
      )}

      <div className="relative min-w-0 flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 rounded-2xl bg-background pl-9"
          placeholder="Tìm món..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <Badge className="h-8 shrink-0 rounded-full px-3" variant="default">
        Ca: {shift.status === "OPEN" ? "mở" : "đóng"}
      </Badge>

      <Button variant="outline" size="icon" className="size-11 rounded-2xl" asChild>
        <Link aria-label="Trang chủ" to="/">
          <Home className="size-5" />
        </Link>
      </Button>
    </header>
  )
}
