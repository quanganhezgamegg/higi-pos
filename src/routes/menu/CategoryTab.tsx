import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from "@/lib/api/menu"

export default function CategoryTab() {
  const [items, setItems] = useState<Category[]>([])
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      setItems(await listCategories(true))
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    let active = true

    listCategories(true)
      .then((categories) => {
        if (active) setItems(categories)
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
      await createCategory(name.trim(), items.length)
      setName("")
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function onToggle(category: Category) {
    setError(null)
    try {
      await updateCategory(category.id, category.name, category.sort_order, !category.is_active)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function onDelete(category: Category) {
    setError(null)
    try {
      await deleteCategory(category.id)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          className="h-11"
          placeholder="Tên danh mục"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button className="h-11" onClick={onAdd}>
          Thêm
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="divide-y rounded-lg border">
        {items.map((category) => (
          <li className="flex min-h-14 items-center justify-between gap-3 p-3" key={category.id}>
            <span
              className={category.is_active ? "font-medium" : "text-muted-foreground line-through"}
            >
              {category.name}
            </span>
            <div className="flex items-center gap-3">
              <Switch
                checked={category.is_active}
                onCheckedChange={() => void onToggle(category)}
              />
              <Button variant="ghost" onClick={() => void onDelete(category)}>
                Xoá
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
