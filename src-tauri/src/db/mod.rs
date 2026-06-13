pub mod migrations;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

/// State được Tauri quản lý: bọc Connection trong Mutex (app 1 máy, 1 người dùng).
pub struct AppDb(pub Mutex<Connection>);

/// Mở (hoặc tạo) file DB tại `path` và chạy migrations.
pub fn open_and_migrate(path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrations::run(&mut conn)?;
    Ok(conn)
}
