use tauri::State;

use crate::db::AppDb;
use crate::domain::settings::{SettingKv, SettingValue, SugarIceInput};
use crate::repo::settings;

#[tauri::command]
pub fn get_setting(db: State<AppDb>, key: String) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::get_setting(&conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(db: State<AppDb>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings_bulk(db: State<AppDb>, keys: Vec<String>) -> Result<Vec<SettingValue>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::get_settings_bulk(&conn, keys).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_settings_bulk(db: State<AppDb>, payload: Vec<SettingKv>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::set_settings_bulk(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_sugar_levels(db: State<AppDb>) -> Result<Vec<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::list_sugar_levels(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_ice_levels(db: State<AppDb>) -> Result<Vec<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::list_ice_levels(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_sugar_ice_levels(db: State<AppDb>, payload: SugarIceInput) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    settings::update_sugar_ice_levels(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
