import { open } from "@tauri-apps/plugin-dialog"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createProduct,
  readImageDataUrl,
  saveProductImage,
  updateProduct,
  type Category,
  type Product,
  type ProductInput,
  type SizeInput,
} from "@/lib/api/menu"

type ProductFormProps = {
  categories: Category[]
  editing?: Product | null
  onDone: () => void
}

export default function ProductForm({ categories, editing, onDone }: ProductFormProps) {
  const [name, setName] = useState(editing?.name ?? "")
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? categories[0]?.id ?? 0)
  const [basePrice, setBasePrice] = useState(editing?.base_price ?? 0)
  const [description, setDescription] = useState(editing?.description ?? "")
  const [imagePath, setImagePath] = useState<string | null>(editing?.image_path ?? null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sizes, setSizes] = useState<SizeInput[]>(
    editing?.sizes.map((size) => ({
      name: size.name,
      price_delta: size.price_delta,
      is_default: size.is_default,
    })) ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (imagePath) {
      readImageDataUrl(imagePath)
        .then((dataUrl) => {
          if (active) setPreview(dataUrl)
        })
        .catch(() => {
          if (active) setPreview(null)
        })
    }

    return () => {
      active = false
    }
  }, [imagePath])

  async function pickImage() {
    setError(null)
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Ảnh", extensions: ["png", "jpg", "jpeg", "webp"] }],
      })

      if (typeof selected === "string") {
        setImagePath(await saveProductImage(selected))
      }
    } catch (e) {
      setError(String(e))
    }
  }

  function setDefaultSize(index: number) {
    setSizes((previous) =>
      previous.map((size, current) => ({
        ...size,
        is_default: current === index,
      })),
    )
  }

  function updateSize(index: number, patch: Partial<SizeInput>) {
    setSizes((previous) =>
      previous.map((size, current) => (current === index ? { ...size, ...patch } : size)),
    )
  }

  async function onSave() {
    setError(null)
    if (!categoryId) {
      setError("Cần tạo danh mục trước khi thêm món")
      return
    }

    const payload: ProductInput = {
      name: name.trim(),
      category_id: categoryId,
      base_price: basePrice,
      description: description.trim() || null,
      image_path: imagePath,
      sort_order: editing?.sort_order ?? 0,
      sizes,
    }

    try {
      if (editing) {
        await updateProduct(editing.id, payload)
      } else {
        await createProduct(payload)
      }
      onDone()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1">
      {categories.length === 0 && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Cần tạo ít nhất một danh mục trước khi thêm món.
        </p>
      )}

      <Input
        className="h-11"
        placeholder="Tên món"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <select
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
        value={categoryId}
        onChange={(e) => setCategoryId(Number(e.target.value))}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <Input
        className="h-11"
        min={0}
        placeholder="Giá gốc (VND)"
        type="number"
        value={basePrice}
        onChange={(e) => setBasePrice(Number(e.target.value))}
      />

      <Input
        className="h-11"
        placeholder="Mô tả"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <Button className="h-11" type="button" variant="outline" onClick={pickImage}>
          Chọn ảnh
        </Button>
        {preview && <img src={preview} alt="" className="size-16 rounded-lg object-cover" />}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Size</span>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setSizes((previous) => [
                ...previous,
                { name: "", price_delta: 0, is_default: previous.length === 0 },
              ])
            }
          >
            Thêm size
          </Button>
        </div>

        {sizes.map((size, index) => (
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_92px_44px]" key={index}>
            <Input
              className="h-11"
              placeholder="Tên size"
              value={size.name}
              onChange={(e) => updateSize(index, { name: e.target.value })}
            />
            <Input
              className="h-11"
              min={0}
              placeholder="Phụ giá"
              type="number"
              value={size.price_delta}
              onChange={(e) => updateSize(index, { price_delta: Number(e.target.value) })}
            />
            <label className="flex h-11 items-center gap-2 text-sm">
              <input
                checked={size.is_default}
                name="default-size"
                type="radio"
                onChange={() => setDefaultSize(index)}
              />
              Mặc định
            </label>
            <Button
              aria-label="Xoá size"
              className="h-11"
              type="button"
              variant="ghost"
              onClick={() =>
                setSizes((previous) => previous.filter((_, current) => current !== index))
              }
            >
              Xoá
            </Button>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button className="h-11" variant="outline" onClick={onDone}>
          Huỷ
        </Button>
        <Button className="h-11" disabled={categories.length === 0} onClick={onSave}>
          Lưu
        </Button>
      </div>
    </div>
  )
}
