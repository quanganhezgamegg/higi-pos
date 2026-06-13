import { invoke } from "@tauri-apps/api/core"

export type Category = {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export type Topping = {
  id: number
  name: string
  price: number
  is_active: boolean
  sort_order: number
}

export type ProductSize = {
  id: number
  name: string
  price_delta: number
  is_default: boolean
}

export type Product = {
  id: number
  category_id: number
  name: string
  base_price: number
  description: string | null
  image_path: string | null
  is_active: boolean
  sort_order: number
  sizes: ProductSize[]
}

export type SizeInput = {
  name: string
  price_delta: number
  is_default: boolean
}

export type ProductInput = {
  name: string
  category_id: number
  base_price: number
  description: string | null
  image_path: string | null
  sort_order: number
  sizes: SizeInput[]
}

export const listCategories = (includeInactive = true) =>
  invoke<Category[]>("list_categories", { includeInactive })

export const createCategory = (name: string, sortOrder = 0) =>
  invoke<Category>("create_category", { name, sortOrder })

export const updateCategory = (id: number, name: string, sortOrder: number, isActive: boolean) =>
  invoke<void>("update_category", { id, name, sortOrder, isActive })

export const deleteCategory = (id: number) => invoke<void>("delete_category", { id })

export const listProducts = (categoryId: number | null = null, includeInactive = true) =>
  invoke<Product[]>("list_products", { categoryId, includeInactive })

export const createProduct = (payload: ProductInput) =>
  invoke<Product>("create_product", { payload })

export const updateProduct = (id: number, payload: ProductInput) =>
  invoke<Product>("update_product", { id, payload })

export const setProductActive = (id: number, isActive: boolean) =>
  invoke<void>("set_product_active", { id, isActive })

export const deleteProduct = (id: number) => invoke<void>("delete_product", { id })

export const listToppings = (includeInactive = true) =>
  invoke<Topping[]>("list_toppings", { includeInactive })

export const createTopping = (name: string, price: number, sortOrder = 0) =>
  invoke<Topping>("create_topping", { name, price, sortOrder })

export const updateTopping = (
  id: number,
  name: string,
  price: number,
  sortOrder: number,
  isActive: boolean,
) => invoke<void>("update_topping", { id, name, price, sortOrder, isActive })

export const deleteTopping = (id: number) => invoke<void>("delete_topping", { id })

export const saveProductImage = (sourcePath: string) =>
  invoke<string>("save_product_image", { sourcePath })

export const readImageDataUrl = (relativePath: string) =>
  invoke<string>("read_image_data_url", { relativePath })
