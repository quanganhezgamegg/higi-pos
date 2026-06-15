import { invoke } from "@tauri-apps/api/core"

export type ReportRangeInput = {
  from: string | null
  to: string | null
  shift_id: number | null
}

export type SalesSummary = {
  revenue: number
  order_count: number
  avg_order_value: number
  discount_total: number
}

export type PaymentMixRow = {
  method: string
  total: number
  count: number
}

export type TopProductRow = {
  product_name: string
  quantity: number
  revenue: number
}

export const reportSalesSummary = (payload: ReportRangeInput) =>
  invoke<SalesSummary>("report_sales_summary", { payload })

export const reportPaymentMix = (payload: ReportRangeInput) =>
  invoke<PaymentMixRow[]>("report_payment_mix", { payload })

export const reportTopProducts = (payload: ReportRangeInput, limit = 10) =>
  invoke<TopProductRow[]>("report_top_products", { payload, limit })

export const reportDiscountTotal = (payload: ReportRangeInput) =>
  invoke<number>("report_discount_total", { payload })

export const reportShiftSummary = (shiftId: number) =>
  invoke<SalesSummary>("report_shift_summary", { shiftId })
