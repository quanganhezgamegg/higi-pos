import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Product, ProductSize, Topping } from "@/lib/api/menu"
import type { OrderItemInput } from "@/lib/api/orders"
import { DEFAULT_ICE_LEVELS, DEFAULT_SUGAR_LEVELS } from "@/lib/constants"
import { formatVnd } from "@/lib/format"
import { calcLine } from "@/store/cartStore"

type OptionDialogProps = {
  product: Product
  toppings: Topping[]
  onClose: () => void
  onAdd: (item: OrderItemInput) => void
}

export function OptionDialog({ product, toppings, onClose, onAdd }: OptionDialogProps) {
  const defaultSize = product.sizes.find((size) => size.is_default) ?? product.sizes[0]
  const [size, setSize] = useState<ProductSize | undefined>(defaultSize)
  const [sugar, setSugar] = useState(DEFAULT_SUGAR_LEVELS[3] ?? DEFAULT_SUGAR_LEVELS[0] ?? null)
  const [ice, setIce] = useState(DEFAULT_ICE_LEVELS[2] ?? DEFAULT_ICE_LEVELS[0] ?? null)
  const [qty, setQty] = useState(1)
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([])
  const [note, setNote] = useState("")

  const unitPrice = product.base_price + (size?.price_delta ?? 0)
  const item: OrderItemInput = {
    product_id: product.id,
    product_name: product.name,
    size_name: size?.name ?? null,
    unit_price: unitPrice,
    quantity: qty,
    sugar_level: sugar,
    ice_level: ice,
    line_note: note.trim() || null,
    line_discount: 0,
    toppings: selectedToppings.map((topping) => ({
      topping_id: topping.id,
      topping_name: topping.name,
      price: topping.price,
      quantity: 1,
    })),
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <OptionGroup label="Size">
            {product.sizes.map((nextSize) => (
              <Button
                key={nextSize.id}
                variant={size?.id === nextSize.id ? "default" : "outline"}
                className="h-11 min-w-16 rounded-xl"
                onClick={() => setSize(nextSize)}
              >
                {nextSize.name}
                {nextSize.price_delta > 0 ? ` +${formatVnd(nextSize.price_delta)}` : ""}
              </Button>
            ))}
          </OptionGroup>

          <OptionGroup label="Đường">
            {DEFAULT_SUGAR_LEVELS.map((level) => (
              <Button
                key={level}
                variant={sugar === level ? "default" : "outline"}
                className="h-11 rounded-xl"
                onClick={() => setSugar(level)}
              >
                {level}
              </Button>
            ))}
          </OptionGroup>

          <OptionGroup label="Đá">
            {DEFAULT_ICE_LEVELS.map((level) => (
              <Button
                key={level}
                variant={ice === level ? "default" : "outline"}
                className="h-11 rounded-xl"
                onClick={() => setIce(level)}
              >
                {level}
              </Button>
            ))}
          </OptionGroup>

          <OptionGroup label="Topping">
            {toppings.map((topping) => {
              const active = selectedToppings.some((item) => item.id === topping.id)
              return (
                <Button
                  key={topping.id}
                  variant={active ? "default" : "outline"}
                  className="h-11 rounded-xl"
                  onClick={() =>
                    setSelectedToppings((items) =>
                      active ? items.filter((item) => item.id !== topping.id) : [...items, topping],
                    )
                  }
                >
                  {topping.name} +{formatVnd(topping.price)}
                </Button>
              )
            })}
          </OptionGroup>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Ghi chú</span>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ít ngọt, không đá..."
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl border p-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
              >
                -
              </Button>
              <span className="w-10 text-center text-lg font-bold">{qty}</span>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl"
                onClick={() => setQty((value) => value + 1)}
              >
                +
              </Button>
            </div>
            <span className="text-lg font-bold">{formatVnd(calcLine(item))}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11 rounded-xl" onClick={onClose}>
            Hủy
          </Button>
          <Button className="h-11 rounded-xl px-6" onClick={() => onAdd(item)}>
            Thêm vào giỏ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OptionGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
