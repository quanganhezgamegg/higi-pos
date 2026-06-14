import { Check, Pencil, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { createArea, deleteArea, listAreas, updateArea, type Area } from "@/lib/api/tables"

type Props = {
  onChanged: () => void
}

export default function AreaManager({ onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [areas, setAreas] = useState<Area[]>([])
  const [name, setName] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      setAreas(await listAreas(true))
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    if (!open) return

    let active = true

    listAreas(true)
      .then((nextAreas) => {
        if (active) setAreas(nextAreas)
      })
      .catch((e) => {
        if (active) setError(String(e))
      })

    return () => {
      active = false
    }
  }, [open])

  async function onAdd() {
    setError(null)
    if (!name.trim()) return

    try {
      await createArea(name.trim(), areas.length)
      setName("")
      await refresh()
      onChanged()
    } catch (e) {
      setError(String(e))
    }
  }

  async function onToggle(area: Area, isActive: boolean) {
    setError(null)
    try {
      await updateArea(area.id, area.name, area.sort_order, isActive)
      await refresh()
      onChanged()
    } catch (e) {
      setError(String(e))
    }
  }

  function startEdit(area: Area) {
    setEditingId(area.id)
    setEditingName(area.name)
    setError(null)
  }

  async function saveEdit(area: Area) {
    setError(null)
    if (!editingName.trim()) return

    try {
      await updateArea(area.id, editingName.trim(), area.sort_order, area.is_active)
      setEditingId(null)
      setEditingName("")
      await refresh()
      onChanged()
    } catch (e) {
      setError(String(e))
    }
  }

  async function onDelete(area: Area) {
    setError(null)
    try {
      await deleteArea(area.id)
      await refresh()
      onChanged()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11" variant="outline">
          Quản lý khu vực
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Khu vực</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="h-11"
            placeholder="Tên khu vực"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button className="h-11" onClick={() => void onAdd()}>
            Thêm
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <ul className="divide-y rounded-lg border">
          {areas.map((area) => {
            const isEditing = editingId === area.id
            return (
              <li className="flex min-h-14 items-center justify-between gap-3 p-3" key={area.id}>
                {isEditing ? (
                  <Input
                    className="h-10"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  <span
                    className={
                      area.is_active ? "font-medium" : "text-muted-foreground line-through"
                    }
                  >
                    {area.name}
                  </span>
                )}

                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={area.is_active}
                    onCheckedChange={(value) => void onToggle(area, value)}
                  />
                  {isEditing ? (
                    <>
                      <Button
                        aria-label="Lưu khu vực"
                        size="icon"
                        title="Lưu khu vực"
                        variant="ghost"
                        onClick={() => void saveEdit(area)}
                      >
                        <Check />
                      </Button>
                      <Button
                        aria-label="Huỷ sửa khu vực"
                        size="icon"
                        title="Huỷ sửa khu vực"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        aria-label="Sửa khu vực"
                        size="icon"
                        title="Sửa khu vực"
                        variant="ghost"
                        onClick={() => startEdit(area)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        aria-label="Xoá khu vực"
                        size="icon"
                        title="Xoá khu vực"
                        variant="ghost"
                        onClick={() => void onDelete(area)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
          {areas.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Chưa có khu vực nào.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
