import { create } from "zustand"

import type { OrderItemInput } from "@/lib/api/orders"

export type CartItem = OrderItemInput & {
  key: string
}

export function calcLine(item: OrderItemInput): number {
  const toppingTotal = item.toppings.reduce(
    (sum, topping) => sum + topping.price * topping.quantity,
    0,
  )
  return Math.max(0, (item.unit_price + toppingTotal) * item.quantity - item.line_discount)
}

function normalizeToppings(item: OrderItemInput) {
  return [...item.toppings].sort((a, b) => {
    const aId = a.topping_id ?? 0
    const bId = b.topping_id ?? 0
    if (aId !== bId) return aId - bId
    return a.topping_name.localeCompare(b.topping_name)
  })
}

function isSameConfig(a: OrderItemInput, b: OrderItemInput): boolean {
  if (a.product_id !== b.product_id) return false
  if (a.product_name !== b.product_name) return false
  if (a.size_name !== b.size_name) return false
  if (a.unit_price !== b.unit_price) return false
  if (a.sugar_level !== b.sugar_level) return false
  if (a.ice_level !== b.ice_level) return false
  if (a.line_note !== b.line_note) return false
  if (a.line_discount !== b.line_discount) return false
  if (a.toppings.length !== b.toppings.length) return false

  const aToppings = normalizeToppings(a)
  const bToppings = normalizeToppings(b)
  return aToppings.every((topping, index) => {
    const other = bToppings[index]
    return (
      topping.topping_id === other.topping_id &&
      topping.topping_name === other.topping_name &&
      topping.price === other.price &&
      topping.quantity === other.quantity
    )
  })
}

function makeKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cart-${Date.now()}-${Math.random()}`
}

type CartState = {
  items: CartItem[]
  addItem: (item: OrderItemInput) => void
  removeItem: (key: string) => void
  setQty: (key: string, qty: number) => void
  clear: () => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [],

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((candidate) => isSameConfig(candidate, item))
      if (!existing) {
        return { items: [...state.items, { ...item, key: makeKey() }] }
      }

      return {
        items: state.items.map((candidate) =>
          candidate.key === existing.key
            ? { ...candidate, quantity: candidate.quantity + item.quantity }
            : candidate,
        ),
      }
    }),

  removeItem: (key) =>
    set((state) => ({
      items: state.items.filter((item) => item.key !== key),
    })),

  setQty: (key, qty) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.key === key ? { ...item, quantity: Math.max(1, qty) } : item,
      ),
    })),

  clear: () => set({ items: [] }),
}))
