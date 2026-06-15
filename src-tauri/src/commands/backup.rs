use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

#[tauri::command]
pub fn backup_database(app: AppHandle, dest_dir: String) -> Result<String, String> {
    let source = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("higipos.db");
    let dest_dir = PathBuf::from(dest_dir);
    std::fs::create_dir_all(&dest_dir).map_err(|error| error.to_string())?;
    let dest = dest_dir.join(format!("higi-backup-{}.db", timestamp()));
    std::fs::copy(&source, &dest).map_err(|error| error.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}
