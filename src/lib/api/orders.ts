import { invoke } from "@tauri-apps/api/core"
import type { OrderDiscount, Payment } from "@/lib/api/payments"

export type OrderType = "DINE_IN" | "TAKEAWAY"
export type OrderStatus = "OPEN" | "PAID" | "CANCELLED"

export type OrderItemToppingInput = {
  topping_id: number | null
  topping_name: string
  price: number
  quantity: number
}

export type OrderItemInput = {
  product_id: number | null
  product_name: string
  size_name: string | null
  unit_price: number
  quantity: number
  sugar_level: string | null
  ice_level: string | null
  line_note: string | null
  line_discount: number
  toppings: OrderItemToppingInput[]
}

export type OrderItemTopping = OrderItemToppingInput & {
  id: number
  order_item_id: number
}

export type OrderItem = Omit<OrderItemInput, "toppings"> & {
  id: number
  order_id: number
  line_total: number
  toppings: OrderItemTopping[]
}

export type Order = {
  id: number
  code: string
  order_type: OrderType
  table_id: number | null
  shift_id: number | null
  status: OrderStatus
  subtotal: number
  discount_total: number
  total: number
  note: string | null
  created_at: string
  paid_at: string | null
  items: OrderItem[]
  discounts: OrderDiscount[]
  payments: Payment[]
}

export type CreateOrderInput = {
  order_type: OrderType
  table_id: number | null
  note: string | null
}

export const createOrder = (payload: CreateOrderInput) => invoke<Order>("create_order", { payload })

export const getOpenOrderForTable = (tableId: number) =>
  invoke<Order | null>("get_open_order_for_table", { tableId })

export const getOrder = (id: number) => invoke<Order>("get_order", { id })

export const addOrderItem = (orderId: number, payload: OrderItemInput) =>
  invoke<Order>("add_order_item", { orderId, payload })

export const updateOrderItem = (itemId: number, payload: OrderItemInput) =>
  invoke<Order>("update_order_item", { itemId, payload })

export const removeOrderItem = (itemId: number) => invoke<Order>("remove_order_item", { itemId })

export const cancelOrder = (id: number) => invoke<Order>("cancel_order", { id })

export const transferTable = (orderId: number, toTableId: number) =>
  invoke<Order>("transfer_table", { orderId, toTableId })

export const mergeTables = (sourceOrderIds: number[], targetOrderId: number) =>
  invoke<Order>("merge_tables", { sourceOrderIds, targetOrderId })

export const listOpenOrders = () => invoke<Order[]>("list_open_orders")
