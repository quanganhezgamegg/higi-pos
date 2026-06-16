import { invoke } from "@tauri-apps/api/core"

export type Branding = {
  shop_name: string
  shop_address: string
  shop_phone: string
  brand_color: string
  logo_path: string | null
  idle_bg_path: string | null
  promo_images: string[]
  customer_welcome_text: string
  bill_footer: string
}

export type Bank = {
  bin: string
  name: string
  short_name: string
}

export const getBranding = () => invoke<Branding>("get_branding")

export const listBanks = () => invoke<Bank[]>("list_banks")

export const saveBrandingImage = (sourcePath: string, kind: string) =>
  invoke<string>("save_branding_image", { sourcePath, kind })
