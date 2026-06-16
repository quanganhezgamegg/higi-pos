import { invoke } from "@tauri-apps/api/core"
import type { OrderType } from "@/lib/api/orders"

export type CustomerPhase = "idle" | "order" | "payment" | "thankyou"

export type CustomerItemToppingView = {
  name: string
  price: number
}

export type CustomerOrderItemView = {
  name: string
  size: string | null
  sugar: string | null
  ice: string | null
  qty: number
  line_total: number
  toppings: CustomerItemToppingView[]
}

export type CustomerOrderView = {
  code: string
  type: OrderType
  table_name: string | null
  items: CustomerOrderItemView[]
  subtotal: number
  discount_total: number
  total: number
}

export type CustomerPaymentView = {
  qr_svg: string
  amount: number
  content: string
  bank_name: string
  account_number: string
}

export type CustomerView = {
  phase: CustomerPhase
  order: CustomerOrderView | null
  payment: CustomerPaymentView | null
}

export type PaymentQr = CustomerPaymentView

export const openCustomerDisplay = () => invoke<void>("open_customer_display")

export const closeCustomerDisplay = () => invoke<void>("close_customer_display")

export const getCustomerView = () => invoke<CustomerView>("get_customer_view")

export const setCustomerOrder = (orderId: number, phase: CustomerPhase) =>
  invoke<void>("set_customer_order", { orderId, phase })

export const setCustomerPhase = (phase: CustomerPhase) =>
  invoke<void>("set_customer_phase", { phase })

export const getPaymentQr = (orderId: number) => invoke<PaymentQr>("get_payment_qr", { orderId })
