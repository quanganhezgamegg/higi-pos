import { invoke } from "@tauri-apps/api/core"
import type { Order } from "@/lib/api/orders"

export type DiscountType = "PERCENT" | "AMOUNT"
export type DiscountScope = "ORDER" | "ITEM"
export type PaymentMethod = "CASH" | "QR"

export type Discount = {
  id: number
  name: string
  type: DiscountType
  value: number
  scope: DiscountScope
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
  sort_order: number
}

export type DiscountInput = {
  name: string
  type: DiscountType
  value: number
  scope: DiscountScope
  valid_from: string | null
  valid_to: string | null
  sort_order: number
}

export type OrderDiscount = {
  id: number
  order_id: number
  discount_id: number | null
  name: string
  type: DiscountType
  value: number
  amount_applied: number
}

export type ApplyDiscountInput = {
  discount_id: number | null
  name: string
  type: DiscountType
  value: number
}

export type Payment = {
  id: number
  order_id: number
  method: PaymentMethod
  amount: number
  tendered: number | null
  change_due: number | null
  paid_at: string
  ref_note: string | null
}

export type PaymentInput = {
  method: PaymentMethod
  amount: number
  tendered: number | null
  ref_note: string | null
}

export const listDiscounts = (includeInactive = true) =>
  invoke<Discount[]>("list_discounts", { includeInactive })

export const createDiscount = (payload: DiscountInput) =>
  invoke<Discount>("create_discount", { payload })

export const updateDiscount = (id: number, payload: DiscountInput) =>
  invoke<Discount>("update_discount", { id, payload })

export const setDiscountActive = (id: number, isActive: boolean) =>
  invoke<void>("set_discount_active", { id, isActive })

export const applyDiscount = (orderId: number, payload: ApplyDiscountInput) =>
  invoke<Order>("apply_discount", { orderId, payload })

export const removeOrderDiscount = (orderDiscountId: number) =>
  invoke<Order>("remove_order_discount", { orderDiscountId })

export const addPayment = (orderId: number, payload: PaymentInput) =>
  invoke<Order>("add_payment", { orderId, payload })

export const finalizeOrder = (orderId: number) => invoke<Order>("finalize_order", { orderId })

export const generateBillHtml = (orderId: number) =>
  invoke<string>("generate_bill_html", { orderId })

export const generateBillPdf = (orderId: number) => invoke<string>("generate_bill_pdf", { orderId })
