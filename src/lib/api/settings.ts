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
