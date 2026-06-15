use tauri::State;

use crate::db::AppDb;
use crate::domain::shifts::{CloseShiftInput, Shift};
use crate::repo::shifts;

fn lock<'a>(
    db: &'a State<'_, AppDb>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    db.0.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_current_shift(db: State<AppDb>) -> Result<Option<Shift>, String> {
    let conn = lock(&db)?;
    shifts::get_current_shift(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_shift(
    db: State<AppDb>,
    opening_cash: i64,
    note: Option<String>,
) -> Result<Shift, String> {
    let conn = lock(&db)?;
    shifts::open_shift(&conn, opening_cash, note).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_shift(
    db: State<AppDb>,
    shift_id: i64,
    payload: CloseShiftInput,
) -> Result<Shift, String> {
    let conn = lock(&db)?;
    shifts::close_shift(&conn, shift_id, payload).map_err(|e| e.to_string())
}
