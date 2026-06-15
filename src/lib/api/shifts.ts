import { invoke } from "@tauri-apps/api/core"

export type ShiftStatus = "OPEN" | "CLOSED"

export type Shift = {
  id: number
  opened_at: string
  closed_at: string | null
  opening_cash: number
  expected_cash: number | null
  closing_cash_counted: number | null
  cash_diff: number | null
  total_sales: number | null
  status: ShiftStatus
  note: string | null
}

export type CloseShiftInput = {
  closing_cash_counted: number
  note: string | null
}

export const getCurrentShift = () => invoke<Shift | null>("get_current_shift")

export const openShift = (openingCash: number, note: string | null) =>
  invoke<Shift>("open_shift", { openingCash, note })

export const closeShift = (shiftId: number, payload: CloseShiftInput) =>
  invoke<Shift>("close_shift", { shiftId, payload })
