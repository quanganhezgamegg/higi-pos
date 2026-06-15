use tauri::State;

use crate::db::AppDb;
use crate::domain::orders::{CreateOrderInput, Order, OrderItemInput};
use crate::repo::orders;

fn lock<'a>(
    db: &'a State<'_, AppDb>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    db.0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_order(db: State<AppDb>, payload: CreateOrderInput) -> Result<Order, String> {
    let conn = lock(&db)?;
    orders::create_order(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_open_order_for_table(db: State<AppDb>, table_id: i64) -> Result<Option<Order>, String> {
    let conn = lock(&db)?;
    orders::get_open_order_for_table(&conn, table_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_order(db: State<AppDb>, id: i64) -> Result<Order, String> {
    let conn = lock(&db)?;
    orders::get_order(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_order_item(
    db: State<AppDb>,
    order_id: i64,
    payload: OrderItemInput,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    orders::add_order_item(&conn, order_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_order_item(
    db: State<AppDb>,
    item_id: i64,
    payload: OrderItemInput,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    orders::update_order_item(&conn, item_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_order_item(db: State<AppDb>, item_id: i64) -> Result<Order, String> {
    let conn = lock(&db)?;
    orders::remove_order_item(&conn, item_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_order(db: State<AppDb>, id: i64) -> Result<Order, String> {
    let conn = lock(&db)?;
    orders::cancel_order(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn transfer_table(db: State<AppDb>, order_id: i64, to_table_id: i64) -> Result<Order, String> {
    let conn = lock(&db)?;
    orders::transfer_table(&conn, order_id, to_table_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn merge_tables(
    db: State<AppDb>,
    source_order_ids: Vec<i64>,
    target_order_id: i64,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    orders::merge_tables(&conn, source_order_ids, target_order_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_open_orders(db: State<AppDb>) -> Result<Vec<Order>, String> {
    let conn = lock(&db)?;
    orders::list_open_orders(&conn).map_err(|e| e.to_string())
}
