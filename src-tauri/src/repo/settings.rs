use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::settings::{SettingKv, SettingValue, SugarIceInput};

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

pub fn get_settings_bulk(
    conn: &Connection,
    keys: Vec<String>,
) -> rusqlite::Result<Vec<SettingValue>> {
    keys.into_iter()
        .map(|key| {
            let value = get_setting(conn, &key)?;
            Ok(SettingValue { key, value })
        })
        .collect()
}

pub fn set_settings_bulk(conn: &Connection, payload: Vec<SettingKv>) -> rusqlite::Result<()> {
    conn.execute_batch("BEGIN")?;
    let result = (|| {
        for item in payload {
            set_setting(conn, &item.key, &item.value)?;
        }
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => conn.execute_batch("COMMIT"),
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn list_sugar_levels(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    Ok(parse_csv_setting(
        get_setting(conn, "sugar_levels")?.as_deref(),
        &["0%", "30%", "50%", "70%", "100%"],
    ))
}

pub fn list_ice_levels(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    Ok(parse_csv_setting(
        get_setting(conn, "ice_levels")?.as_deref(),
        &["Không", "Ít", "Vừa", "Nhiều"],
    ))
}

pub fn update_sugar_ice_levels(conn: &Connection, payload: SugarIceInput) -> rusqlite::Result<()> {
    let sugar_levels = clean_list(payload.sugar_levels);
    let ice_levels = clean_list(payload.ice_levels);
    if sugar_levels.is_empty() || ice_levels.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Mức đường/đá không được rỗng".into(),
        ));
    }
    set_settings_bulk(
        conn,
        vec![
            SettingKv {
                key: "sugar_levels".into(),
                value: sugar_levels.join(","),
            },
            SettingKv {
                key: "ice_levels".into(),
                value: ice_levels.join(","),
            },
        ],
    )
}

fn parse_csv_setting(value: Option<&str>, defaults: &[&str]) -> Vec<String> {
    value
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(String::from)
                .collect()
        })
        .filter(|items: &Vec<String>| !items.is_empty())
        .unwrap_or_else(|| defaults.iter().map(|value| (*value).to_string()).collect())
}

fn clean_list(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect()
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
        assert_eq!(
            get_setting(&conn, "shop_name").unwrap(),
            Some("B".to_string())
        );
    }

    #[test]
    fn get_missing_returns_none() {
        let conn = test_conn();
        assert_eq!(get_setting(&conn, "nope").unwrap(), None);
    }

    #[test]
    fn bulk_read_write_and_sugar_ice() {
        let conn = test_conn();
        set_settings_bulk(
            &conn,
            vec![
                SettingKv {
                    key: "shop_name".into(),
                    value: "HiGi".into(),
                },
                SettingKv {
                    key: "rounding_unit".into(),
                    value: "1".into(),
                },
            ],
        )
        .unwrap();
        let values = get_settings_bulk(&conn, vec!["shop_name".into(), "missing".into()]).unwrap();
        assert_eq!(values[0].value, Some("HiGi".into()));
        assert_eq!(values[1].value, None);

        update_sugar_ice_levels(
            &conn,
            SugarIceInput {
                sugar_levels: vec!["50%".into(), "100%".into()],
                ice_levels: vec!["Ít".into(), "Nhiều".into()],
            },
        )
        .unwrap();
        assert_eq!(list_sugar_levels(&conn).unwrap(), vec!["50%", "100%"]);
        assert_eq!(list_ice_levels(&conn).unwrap(), vec!["Ít", "Nhiều"]);
    }
}
