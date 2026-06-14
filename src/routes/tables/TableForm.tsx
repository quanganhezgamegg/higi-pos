import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createTable, updateTable, type Area, type Table, type TableInput } from "@/lib/api/tables"

type Props = {
  areas: Area[]
  editing?: Table | null
  defaultAreaId?: number
  onDone: () => void
}

export default function TableForm({ areas, editing, defaultAreaId, onDone }: Props) {
  const initialAreaId = editing?.area_id ?? defaultAreaId ?? areas[0]?.id ?? 0
  const [name, setName] = useState(editing?.name ?? "")
  const [areaId, setAreaId] = useState(initialAreaId)
  const [seats, setSeats] = useState(editing?.seats?.toString() ?? "")
  const [sortOrder, setSortOrder] = useState(editing?.sort_order ?? 0)
  const [error, setError] = useState<string | null>(null)

  async function onSave() {
    setError(null)
    if (!areaId) {
      setError("Vui lòng tạo khu vực trước")
      return
    }
    if (!name.trim()) {
      setError("Tên bàn không được rỗng")
      return
    }

    const normalizedSeats = seats.trim() === "" ? null : Number(seats)
    const payload: TableInput = {
      area_id: areaId,
      name: name.trim(),
      seats: normalizedSeats,
      sort_order: sortOrder,
    }

    try {
      if (editing) await updateTable(editing.id, payload)
      else await createTable(payload)
      onDone()
    } catch (e) {
      setError(String(e))
    }
  }

  if (areas.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Hãy tạo khu vực trước khi thêm bàn.</p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onDone}>
            Đóng
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        className="h-11"
        placeholder="Tên bàn, ví dụ B01"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={areaId}
        onChange={(e) => setAreaId(Number(e.target.value))}
      >
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
            {!area.is_active ? " (ngừng dùng)" : ""}
          </option>
        ))}
      </select>
      <Input
        className="h-11"
        min={0}
        placeholder="Số ghế"
        type="number"
        value={seats}
        onChange={(e) => setSeats(e.target.value)}
      />
      <Input
        className="h-11"
        placeholder="Thứ tự hiển thị"
        type="number"
        value={sortOrder}
        onChange={(e) => setSortOrder(Number(e.target.value))}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button className="h-11" variant="outline" onClick={onDone}>
          Huỷ
        </Button>
        <Button className="h-11" onClick={() => void onSave()}>
          Lưu
        </Button>
      </div>
    </div>
  )
}
