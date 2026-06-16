import { Plus } from "lucide-react"

import type { Product, Topping } from "@/lib/api/menu"
import type { OrderItemInput } from "@/lib/api/orders"
import { DEFAULT_ICE_LEVELS, DEFAULT_SUGAR_LEVELS } from "@/lib/constants"
import { formatVnd } from "@/lib/format"
import { useCartStore } from "@/store/cartStore"

type ProductGridProps = {
  products: Product[]
  toppings: Topping[]
  onOpenDialog: (product: Product) => void
}

function canQuickAdd(product: Product, toppings: Topping[]): boolean {
  return product.sizes.length === 1 && toppings.length === 0
}

export function ProductGrid({ products, toppings, onOpenDialog }: ProductGridProps) {
  const addItem = useCartStore((state) => state.addItem)

  function handleClick(product: Product) {
    if (!canQuickAdd(product, toppings)) {
      onOpenDialog(product)
      return
    }

    const size = product.sizes[0]
    const item: OrderItemInput = {
      product_id: product.id,
      product_name: product.name,
      size_name: size.name,
      unit_price: product.base_price + size.price_delta,
      quantity: 1,
      sugar_level: DEFAULT_SUGAR_LEVELS[3] ?? DEFAULT_SUGAR_LEVELS[0] ?? null,
      ice_level: DEFAULT_ICE_LEVELS[2] ?? DEFAULT_ICE_LEVELS[0] ?? null,
      line_note: null,
      line_discount: 0,
      toppings: [],
    }
    addItem(item)
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Khong co mon nao
      </div>
    )
  }

  return (
    <div className="grid auto-rows-min grid-cols-2 gap-4 overflow-y-auto p-5 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          isQuickAdd={canQuickAdd(product, toppings)}
          product={product}
          onClick={() => handleClick(product)}
        />
      ))}
    </div>
  )
}

function ProductCard({
  isQuickAdd,
  product,
  onClick,
}: {
  isQuickAdd: boolean
  product: Product
  onClick: () => void
}) {
  const firstLetter = product.name.trim().charAt(0).toUpperCase() || "H"

  return (
    <button
      className="group flex min-h-[176px] flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-[0.98]"
      data-testid={`product-card-${product.id}`}
      onClick={onClick}
    >
      <div className="flex h-24 w-full items-center justify-center bg-secondary text-3xl font-extrabold text-primary">
        {firstLetter}
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <p className="line-clamp-2 font-bold leading-tight">{product.name}</p>
          {!isQuickAdd && (
            <p className="mt-1 text-xs text-muted-foreground">
              {product.sizes.length > 1 ? "Chon size" : "Co topping"}
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xl font-extrabold text-primary">
            {formatVnd(product.base_price)}
          </span>
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground transition group-hover:bg-primary/80">
            <Plus className="size-5" />
          </span>
        </div>
      </div>
    </button>
  )
}
