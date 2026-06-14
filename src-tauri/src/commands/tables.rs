use tauri::State;

use crate::db::AppDb;
use crate::domain::tables::{Area, Table, TableInput, TableStatus};
use crate::repo::tables;

fn lock<'a>(
    db: &'a State<'_, AppDb>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    db.0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_areas(db: State<AppDb>, include_inactive: bool) -> Result<Vec<Area>, String> {
    let conn = lock(&db)?;
    tables::list_areas(&conn, include_inactive).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_area(db: State<AppDb>, name: String, sort_order: i64) -> Result<Area, String> {
    let conn = lock(&db)?;
    tables::create_area(&conn, &name, sort_order).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_area(
    db: State<AppDb>,
    id: i64,
    name: String,
    sort_order: i64,
    is_active: bool,
) -> Result<(), String> {
    let conn = lock(&db)?;
    tables::update_area(&conn, id, &name, sort_order, is_active).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_area(db: State<AppDb>, id: i64) -> Result<(), String> {
    let conn = lock(&db)?;
    tables::delete_area(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tables(
    db: State<AppDb>,
    area_id: Option<i64>,
    include_inactive: bool,
) -> Result<Vec<Table>, String> {
    let conn = lock(&db)?;
    tables::list_tables(&conn, area_id, include_inactive).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_table(db: State<AppDb>, payload: TableInput) -> Result<Table, String> {
    let conn = lock(&db)?;
    tables::create_table(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_table(db: State<AppDb>, id: i64, payload: TableInput) -> Result<Table, String> {
    let conn = lock(&db)?;
    tables::update_table(&conn, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_table_active(db: State<AppDb>, id: i64, is_active: bool) -> Result<(), String> {
    let conn = lock(&db)?;
    tables::set_table_active(&conn, id, is_active).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_table(db: State<AppDb>, id: i64) -> Result<(), String> {
    let conn = lock(&db)?;
    tables::delete_table(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_table_status(db: State<AppDb>) -> Result<Vec<TableStatus>, String> {
    let conn = lock(&db)?;
    tables::list_table_status(&conn).map_err(|e| e.to_string())
}
