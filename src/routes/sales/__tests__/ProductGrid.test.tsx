import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Product, Topping } from "@/lib/api/menu"
import { useCartStore } from "@/store/cartStore"
import { ProductGrid } from "@/routes/sales/ProductGrid"

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    category_id: 1,
    name: "Ca phe sua",
    base_price: 45_000,
    description: null,
    image_path: null,
    is_active: true,
    sort_order: 0,
    sizes: [{ id: 1, name: "M", price_delta: 0, is_default: true }],
    ...overrides,
  }
}

function makeTopping(overrides: Partial<Topping> = {}): Topping {
  return {
    id: 1,
    name: "Tran chau",
    price: 5_000,
    is_active: true,
    sort_order: 0,
    ...overrides,
  }
}

beforeEach(() => {
  useCartStore.setState({ items: [] })
})

describe("ProductGrid", () => {
  it("quick-adds a product with one size and no toppings", () => {
    const onOpenDialog = vi.fn()

    render(<ProductGrid products={[makeProduct()]} toppings={[]} onOpenDialog={onOpenDialog} />)
    fireEvent.click(screen.getByTestId("product-card-1"))

    expect(onOpenDialog).not.toHaveBeenCalled()
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].product_name).toBe("Ca phe sua")
  })

  it("opens options for a product with multiple sizes", () => {
    const onOpenDialog = vi.fn()
    const product = makeProduct({
      sizes: [
        { id: 1, name: "M", price_delta: 0, is_default: true },
        { id: 2, name: "L", price_delta: 5_000, is_default: false },
      ],
    })

    render(<ProductGrid products={[product]} toppings={[]} onOpenDialog={onOpenDialog} />)
    fireEvent.click(screen.getByTestId("product-card-1"))

    expect(onOpenDialog).toHaveBeenCalledWith(product)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it("opens options when toppings are available", () => {
    const onOpenDialog = vi.fn()

    render(
      <ProductGrid
        products={[makeProduct()]}
        toppings={[makeTopping()]}
        onOpenDialog={onOpenDialog}
      />,
    )
    fireEvent.click(screen.getByTestId("product-card-1"))

    expect(onOpenDialog).toHaveBeenCalledWith(makeProduct())
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})
