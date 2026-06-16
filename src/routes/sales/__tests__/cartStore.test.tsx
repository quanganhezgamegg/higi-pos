import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import type { OrderItemInput } from "@/lib/api/orders"
import { calcLine, useCartStore } from "@/store/cartStore"

function makeItem(overrides: Partial<OrderItemInput> = {}): OrderItemInput {
  return {
    product_id: 1,
    product_name: "Ca phe sua",
    size_name: "M",
    unit_price: 45_000,
    quantity: 1,
    sugar_level: "70%",
    ice_level: "Vua",
    line_note: null,
    line_discount: 0,
    toppings: [],
    ...overrides,
  }
}

beforeEach(() => {
  useCartStore.setState({ items: [] })
})

describe("calcLine", () => {
  it("multiplies unit price by quantity", () => {
    expect(calcLine(makeItem({ quantity: 2, unit_price: 45_000 }))).toBe(90_000)
  })

  it("adds topping price before multiplying quantity", () => {
    expect(
      calcLine(
        makeItem({
          quantity: 2,
          toppings: [{ topping_id: 1, topping_name: "Tran chau", price: 5_000, quantity: 1 }],
        }),
      ),
    ).toBe(100_000)
  })

  it("subtracts line discount and never returns a negative value", () => {
    expect(calcLine(makeItem({ unit_price: 10_000, line_discount: 99_999 }))).toBe(0)
  })
})

describe("useCartStore", () => {
  it("adds a new item to the cart", () => {
    const { result } = renderHook(() => useCartStore())

    act(() => result.current.addItem(makeItem()))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].product_name).toBe("Ca phe sua")
  })

  it("stacks matching product configuration into one line", () => {
    const { result } = renderHook(() => useCartStore())

    act(() => result.current.addItem(makeItem({ quantity: 1 })))
    act(() => result.current.addItem(makeItem({ quantity: 2 })))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(3)
  })

  it("does not stack items with different options", () => {
    const { result } = renderHook(() => useCartStore())

    act(() => result.current.addItem(makeItem({ size_name: "M" })))
    act(() => result.current.addItem(makeItem({ size_name: "L" })))

    expect(result.current.items).toHaveLength(2)
  })

  it("updates quantity with a minimum of one", () => {
    const { result } = renderHook(() => useCartStore())

    act(() => result.current.addItem(makeItem()))
    const key = result.current.items[0].key
    act(() => result.current.setQty(key, 0))

    expect(result.current.items[0].quantity).toBe(1)
  })

  it("removes one line and clears the whole cart", () => {
    const { result } = renderHook(() => useCartStore())

    act(() => result.current.addItem(makeItem()))
    act(() => result.current.addItem(makeItem({ product_id: 2, product_name: "Bac xiu" })))
    const firstKey = result.current.items[0].key
    act(() => result.current.removeItem(firstKey))
    expect(result.current.items).toHaveLength(1)

    act(() => result.current.clear())
    expect(result.current.items).toHaveLength(0)
  })
})
