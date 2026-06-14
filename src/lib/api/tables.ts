import { invoke } from "@tauri-apps/api/core"

export type Area = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export type Table = {
  id: number
  area_id: number
  name: string
  seats: number | null
  sort_order: number
  is_active: boolean
}

export type TableInput = {
  area_id: number
  name: string
  seats: number | null
  sort_order: number
}

export type TableState = "TRONG" | "DANG_PHUC_VU"

export type TableStatus = {
  table: Table
  status: TableState
  open_order_id: number | null
}

export const listAreas = (includeInactive = true) =>
  invoke<Area[]>("list_areas", { includeInactive })

export const createArea = (name: string, sortOrder = 0) =>
  invoke<Area>("create_area", { name, sortOrder })

export const updateArea = (id: number, name: string, sortOrder: number, isActive: boolean) =>
  invoke<void>("update_area", { id, name, sortOrder, isActive })

export const deleteArea = (id: number) => invoke<void>("delete_area", { id })

export const listTables = (areaId: number | null = null, includeInactive = true) =>
  invoke<Table[]>("list_tables", { areaId, includeInactive })

export const createTable = (payload: TableInput) => invoke<Table>("create_table", { payload })

export const updateTable = (id: number, payload: TableInput) =>
  invoke<Table>("update_table", { id, payload })

export const setTableActive = (id: number, isActive: boolean) =>
  invoke<void>("set_table_active", { id, isActive })

export const deleteTable = (id: number) => invoke<void>("delete_table", { id })

export const listTableStatus = () => invoke<TableStatus[]>("list_table_status")
