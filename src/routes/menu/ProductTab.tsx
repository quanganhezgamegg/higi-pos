import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { formatVnd } from "@/lib/format"
import {
  deleteProduct,
  listCategories,
  listProducts,
  readImageDataUrl,
  setProductActive,
  type Category,
  type Product,
} from "@/lib/api/menu"
import ProductForm from "@/routes/menu/ProductForm"

async function loadThumbnails(products: Product[]) {
  const entries = await Promise.all(
    products
      .filter((product) => product.image_path)
      .map(async (product) => [product.id, await readImageDataUrl(product.image_path!)] as const),
  )
  return Object.fromEntries(entries)
}

export default function ProductTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Product[]>([])
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setError(null)
    try {
      const [loadedCategories, loadedProducts] = await Promise.all([
        listCategories(true),
        listProducts(null, true),
      ])
      setCategories(loadedCategories)
      setItems(loadedProducts)
      setThumbs(await loadThumbnails(loadedProducts))
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    let active = true

    Promise.all([listCategories(true), listProducts(null, true)])
      .then(async ([loadedCategories, loadedProducts]) => {
        const loadedThumbs = await loadThumbnails(loadedProducts)
        if (!active) return
        setCategories(loadedCategories)
        setItems(loadedProducts)
        setThumbs(loadedThumbs)
      })
      .catch((e) => {
        if (active) setError(String(e))
      })

    return () => {
      active = false
    }
  }, [])

  async function onToggle(product: Product, isActive: boolean) {
    try {
      await setProductActive(product.id, isActive)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function onDelete(product: Product) {
    setError(null)
    try {
      await deleteProduct(product.id)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  function closeForm() {
    setOpen(false)
    setEditing(null)
    void refresh()
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="h-11"
              onClick={() => {
                setEditing(null)
              }}
            >
              Thêm món
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogTitle>{editing ? "Sửa món" : "Thêm món"}</DialogTitle>
            <ProductForm categories={categories} editing={editing} onDone={closeForm} />
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="divide-y rounded-lg border">
        {items.map((product) => (
          <li className="flex min-h-16 items-center justify-between gap-3 p-3" key={product.id}>
            <div className="flex min-w-0 items-center gap-3">
              {thumbs[product.id] ? (
                <img
                  src={thumbs[product.id]}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="size-12 shrink-0 rounded-lg bg-muted" />
              )}
              <div className="min-w-0">
                <div
                  className={
                    product.is_active
                      ? "truncate font-medium"
                      : "truncate font-medium text-muted-foreground line-through"
                  }
                >
                  {product.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatVnd(product.base_price)} · {product.sizes.length} size
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Switch
                checked={product.is_active}
                onCheckedChange={(value) => void onToggle(product, value)}
              />
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(product)
                  setOpen(true)
                }}
              >
                Sửa
              </Button>
              <Button variant="ghost" onClick={() => void onDelete(product)}>
                Xoá
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
