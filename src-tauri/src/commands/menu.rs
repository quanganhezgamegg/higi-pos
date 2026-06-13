use tauri::State;

use crate::db::AppDb;
use crate::domain::menu::{Category, ProductInput, ProductWithSizes, Topping};
use crate::repo::menu;

fn lock<'a>(
    db: &'a State<'_, AppDb>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    db.0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_categories(db: State<AppDb>, include_inactive: bool) -> Result<Vec<Category>, String> {
    let conn = lock(&db)?;
    menu::list_categories(&conn, include_inactive).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(
    db: State<AppDb>,
    name: String,
    sort_order: i64,
) -> Result<Category, String> {
    let conn = lock(&db)?;
    menu::create_category(&conn, &name, sort_order).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_category(
    db: State<AppDb>,
    id: i64,
    name: String,
    sort_order: i64,
    is_active: bool,
) -> Result<(), String> {
    let conn = lock(&db)?;
    menu::update_category(&conn, id, &name, sort_order, is_active).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_category(db: State<AppDb>, id: i64) -> Result<(), String> {
    let conn = lock(&db)?;
    menu::delete_category(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_products(
    db: State<AppDb>,
    category_id: Option<i64>,
    include_inactive: bool,
) -> Result<Vec<ProductWithSizes>, String> {
    let conn = lock(&db)?;
    menu::list_products(&conn, category_id, include_inactive).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_product(db: State<AppDb>, payload: ProductInput) -> Result<ProductWithSizes, String> {
    let conn = lock(&db)?;
    menu::create_product(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_product(
    db: State<AppDb>,
    id: i64,
    payload: ProductInput,
) -> Result<ProductWithSizes, String> {
    let conn = lock(&db)?;
    menu::update_product(&conn, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_product_active(db: State<AppDb>, id: i64, is_active: bool) -> Result<(), String> {
    let conn = lock(&db)?;
    menu::set_product_active(&conn, id, is_active).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_product(db: State<AppDb>, id: i64) -> Result<(), String> {
    let conn = lock(&db)?;
    menu::delete_product(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_toppings(db: State<AppDb>, include_inactive: bool) -> Result<Vec<Topping>, String> {
    let conn = lock(&db)?;
    menu::list_toppings(&conn, include_inactive).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_topping(
    db: State<AppDb>,
    name: String,
    price: i64,
    sort_order: i64,
) -> Result<Topping, String> {
    let conn = lock(&db)?;
    menu::create_topping(&conn, &name, price, sort_order).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_topping(
    db: State<AppDb>,
    id: i64,
    name: String,
    price: i64,
    sort_order: i64,
    is_active: bool,
) -> Result<(), String> {
    let conn = lock(&db)?;
    menu::update_topping(&conn, id, &name, price, sort_order, is_active).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_topping(db: State<AppDb>, id: i64) -> Result<(), String> {
    let conn = lock(&db)?;
    menu::delete_topping(&conn, id).map_err(|e| e.to_string())
}
