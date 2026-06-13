import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { formatVnd } from "@/lib/format"
import {
  createTopping,
  deleteTopping,
  listToppings,
  updateTopping,
  type Topping,
} from "@/lib/api/menu"

export default function ToppingTab() {
  const [items, setItems] = useState<Topping[]>([])
  const [name, setName] = useState("")
  const [price, setPrice] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      setItems(await listToppings(true))
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    let active = true

    listToppings(true)
      .then((toppings) => {
        if (active) setItems(toppings)
      })
      .catch((e) => {
        if (active) setError(String(e))
      })

    return () => {
      active = false
    }
  }, [])

  async function onAdd() {
    setError(null)
    if (!name.trim()) return

    try {
      await createTopping(name.trim(), price, items.length)
      setName("")
      setPrice(0)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function onToggle(topping: Topping, isActive: boolean) {
    setError(null)
    try {
      await updateTopping(topping.id, topping.name, topping.price, topping.sort_order, isActive)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function onDelete(topping: Topping) {
    setError(null)
    try {
      await deleteTopping(topping.id)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
        <Input
          className="h-11"
          placeholder="Tên topping"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          className="h-11"
          min={0}
          placeholder="Giá"
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
        <Button className="h-11" onClick={onAdd}>
          Thêm
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="divide-y rounded-lg border">
        {items.map((topping) => (
          <li className="flex min-h-14 items-center justify-between gap-3 p-3" key={topping.id}>
            <span
              className={topping.is_active ? "font-medium" : "text-muted-foreground line-through"}
            >
              {topping.name} · {formatVnd(topping.price)}
            </span>
            <div className="flex items-center gap-3">
              <Switch
                checked={topping.is_active}
                onCheckedChange={(value) => void onToggle(topping, value)}
              />
              <Button variant="ghost" onClick={() => void onDelete(topping)}>
                Xoá
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
