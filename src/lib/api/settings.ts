import { invoke } from "@tauri-apps/api/core"

export function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key })
}

export function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>("set_setting", { key, value })
}

export function appVersion(): Promise<string> {
  return invoke<string>("app_version")
}

export type SettingKv = {
  key: string
  value: string
}

export type SettingValue = {
  key: string
  value: string | null
}

export type SugarIceInput = {
  sugar_levels: string[]
  ice_levels: string[]
}

export function getSettingsBulk(keys: string[]): Promise<SettingValue[]> {
  return invoke<SettingValue[]>("get_settings_bulk", { keys })
}

export function setSettingsBulk(payload: SettingKv[]): Promise<void> {
  return invoke<void>("set_settings_bulk", { payload })
}

export function listSugarLevels(): Promise<string[]> {
  return invoke<string[]>("list_sugar_levels")
}

export function listIceLevels(): Promise<string[]> {
  return invoke<string[]>("list_ice_levels")
}

export function updateSugarIceLevels(payload: SugarIceInput): Promise<void> {
  return invoke<void>("update_sugar_ice_levels", { payload })
}

export function backupDatabase(destDir: string): Promise<string> {
  return invoke<string>("backup_database", { destDir })
}
