import { Pencil, Power, Receipt, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Table, TableState } from "@/lib/api/tables"

type Props = {
  table: Table
  status: TableState
  onEdit: (table: Table) => void
  onDelete: (table: Table) => void
  onToggleActive: (table: Table) => void
  onOpen?: (table: Table) => void
}

function statusMeta(table: Table, status: TableState) {
  if (!table.is_active) {
    return {
      label: "Ngừng dùng",
      badgeClass: "border-transparent bg-muted text-muted-foreground",
      cardClass: "bg-muted/30",
    }
  }
  if (status === "DANG_PHUC_VU") {
    return {
      label: "Đang phục vụ",
      badgeClass: "border-transparent bg-[oklch(0.92_0.08_83)] text-[oklch(0.32_0.08_63)]",
      cardClass: "border-[oklch(0.74_0.13_75)] bg-[oklch(0.98_0.03_82)]",
    }
  }
  return {
    label: "Trống",
    badgeClass: "border-transparent bg-[oklch(0.93_0.08_145)] text-[oklch(0.34_0.08_145)]",
    cardClass: "border-[oklch(0.78_0.12_145)] bg-[oklch(0.98_0.03_145)]",
  }
}

export default function TableCard({
  table,
  status,
  onEdit,
  onDelete,
  onToggleActive,
  onOpen,
}: Props) {
  const meta = statusMeta(table, status)
  const actionLabel = status === "DANG_PHUC_VU" ? "Mở đơn" : "Bán tại bàn"
  const actionAria = status === "DANG_PHUC_VU" ? "Mo don" : "Ban tai ban"

  return (
    <Card className={`min-h-[144px] min-w-[164px] ${meta.cardClass}`}>
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold">{table.name}</p>
            {table.seats != null && (
              <p className="text-sm text-muted-foreground">{table.seats} ghế</p>
            )}
          </div>
          <Badge className={meta.badgeClass}>{meta.label}</Badge>
        </div>

        {table.is_active && (
          <Button
            aria-label={actionAria}
            className="mt-auto h-10 w-full"
            disabled={!onOpen}
            variant={status === "DANG_PHUC_VU" ? "default" : "outline"}
            onClick={() => onOpen?.(table)}
          >
            <Receipt className="size-4" />
            {actionLabel}
          </Button>
        )}

        <div className="flex justify-end gap-1">
          <Button
            aria-label="Sửa bàn"
            className="size-9"
            size="icon"
            title="Sửa bàn"
            variant="ghost"
            onClick={() => onEdit(table)}
          >
            <Pencil />
          </Button>
          <Button
            aria-label={table.is_active ? "Tắt bàn" : "Bật bàn"}
            className="size-9"
            size="icon"
            title={table.is_active ? "Tắt bàn" : "Bật bàn"}
            variant="ghost"
            onClick={() => onToggleActive(table)}
          >
            <Power />
          </Button>
          <Button
            aria-label="Xoá bàn"
            className="size-9"
            size="icon"
            title="Xoá bàn"
            variant="ghost"
            onClick={() => onDelete(table)}
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
