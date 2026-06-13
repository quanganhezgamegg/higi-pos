use rusqlite::{params, Connection, OptionalExtension};

/// Ghi/ghi đè một cấu hình key-value.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings(key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

/// Đọc một cấu hình; trả None nếu không tồn tại.
pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .optional()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn test_conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        migrations::run(&mut c).unwrap();
        c
    }

    #[test]
    fn set_then_get_returns_value() {
        let conn = test_conn();
        set_setting(&conn, "shop_name", "HiGi").unwrap();
        assert_eq!(
            get_setting(&conn, "shop_name").unwrap(),
            Some("HiGi".to_string())
        );
    }

    #[test]
    fn set_twice_overwrites() {
        let conn = test_conn();
        set_setting(&conn, "shop_name", "A").unwrap();
        set_setting(&conn, "shop_name", "B").unwrap();
        assert_eq!(get_setting(&conn, "shop_name").unwrap(), Some("B".to_string()));
    }

    #[test]
    fn get_missing_returns_none() {
        let conn = test_conn();
        assert_eq!(get_setting(&conn, "nope").unwrap(), None);
    }
}
